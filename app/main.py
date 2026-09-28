"""Nekochat Reloaded companion server.

Adds what the Nekochat Reloaded clients need beyond the Nekochat server: settings and
read state shared between a user's devices ("memory"), and room for new features.
It does not replace or proxy the Nekochat API. The only call to the Nekochat server is
GET /api/me during /link, to learn who the owner of a Nekochat token is.
"""
from __future__ import annotations

import asyncio
import hashlib
import html
import ipaddress
import re
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

VERSION = "0.8.0"
# Nekochat servers this companion accepts accounts from (comma-separated base URLs).
NEKOCHAT_SERVERS = [url.strip().rstrip("/") for url in os.environ.get("NEKOCHAT_SERVERS", "https://nekochat.komdu.is-cool.dev").split(",") if url.strip()]
DATABASE = Path(os.environ.get("RELOADED_DB", "reloaded.db"))
SESSION_DAYS = int(os.environ.get("RELOADED_SESSION_DAYS", "30"))
MAX_SETTINGS_BYTES = 64 * 1024
MAX_READ_STATE_CHATS = 2000
BACKUPS = Path(os.environ.get("RELOADED_BACKUPS", str(DATABASE.resolve().parent / "backups")))
MAX_BACKUP_BYTES = int(os.environ.get("RELOADED_BACKUP_MB", "50")) * 1024 * 1024
MAX_BACKUPS = int(os.environ.get("RELOADED_MAX_BACKUPS", "10"))

DESCRIPTION = """
Companion server for the **Nekochat Reloaded** clients: settings and read state shared between
a user's devices, and statuses other Reloaded users can see, and settings backups (zip archives made by the client).

**Accounts.** Sign in to your Nekochat server, then call `POST /link` with the Nekochat token
(`Authorization: Bearer <Nekochat token>`). The companion checks it once with that server's
`/api/me` and answers with its own session token; the Nekochat token is not stored.
Use the companion token for every other request (the **Authorize** button above).
"""
TAGS = [
    {"name": "account", "description": "Linking a Nekochat account and the session"},
    {"name": "sync", "description": "Settings and read state shared between devices"},
    {"name": "status", "description": "Online, away, do-not-disturb and invisible statuses"},
    {"name": "chats", "description": "Reactions, pinned messages, typing and read receipts of rooms and direct chats"},
    {"name": "backups", "description": "Settings backups: zip archives with the client's settings, themes and pictures"},
    {"name": "server", "description": "Server information"},
]
# Same layout as the Nekochat server: Swagger UI at /api/docs, the spec at /api/openapi.json.
app = FastAPI(title="Nekochat Reloaded companion", version=VERSION, description=DESCRIPTION, openapi_tags=TAGS,
              docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
bearer = HTTPBearer(auto_error=False, description="Companion session token from /link (or, for /link itself, the Nekochat token)")
# The web client runs on another origin (GitHub Pages); sessions use a bearer header, not cookies.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---- storage -------------------------------------------------------------------------------
def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def database():
    connection = connect()
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def migrate() -> None:
    with database() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server TEXT NOT NULL,            -- Nekochat server base URL
                nekochat_id INTEGER NOT NULL,    -- user id on that server
                profile TEXT NOT NULL,           -- last /api/me answer (JSON)
                settings TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE (server, nekochat_id)
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,     -- sha256 of the session token; the token itself is never stored
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                device TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_status (
                account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
                status TEXT NOT NULL,            -- online, away, dnd (do not disturb) or invisible
                client TEXT NOT NULL DEFAULT '', -- app the user last reported from, e.g. "Android 1.4.1"
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS backups (
                id TEXT PRIMARY KEY,             -- random; also the file name in the backups folder
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                device TEXT NOT NULL DEFAULT '',
                client TEXT NOT NULL DEFAULT '',  -- client that made it, e.g. "PC 1.3.1"
                size INTEGER NOT NULL,
                sha256 TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reactions (
                server TEXT NOT NULL,
                chat TEXT NOT NULL,              -- "room:<id>" or "dm:<smaller id>-<larger id>"
                message TEXT NOT NULL,           -- Nekochat message id
                nekochat_id INTEGER NOT NULL,    -- who reacted
                emoji TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (server, chat, message, nekochat_id, emoji)
            );
            CREATE TABLE IF NOT EXISTS pins (
                server TEXT NOT NULL,
                chat TEXT NOT NULL,
                message TEXT NOT NULL,
                content TEXT NOT NULL,           -- short copy of the text, shown in the pin bar
                author TEXT NOT NULL,
                pinned_by INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (server, chat, message)
            );
            CREATE TABLE IF NOT EXISTS drafts (
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                chat TEXT NOT NULL,              -- the client's own key: "room:<id>" or "dm:<other id>"
                text TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (account_id, chat)
            );
            CREATE TABLE IF NOT EXISTS read_state (
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                chat TEXT NOT NULL,              -- "room:<id>" or "dm:<user id>"
                last_read TEXT NOT NULL,         -- id of the last read message
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (account_id, chat)
            );
            """
        )
        # Backups made by server 0.4.0 have no client column yet.
        columns = [row["name"] for row in db.execute("PRAGMA table_info(user_status)")]
        if "client" not in columns:
            db.execute("ALTER TABLE user_status ADD COLUMN client TEXT NOT NULL DEFAULT ''")
        if "last_seen" not in columns:
            db.execute("ALTER TABLE user_status ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0")
        if "hide_last_seen" not in columns:
            db.execute("ALTER TABLE user_status ADD COLUMN hide_last_seen INTEGER NOT NULL DEFAULT 0")
        if "client" not in [row["name"] for row in db.execute("PRAGMA table_info(backups)")]:
            db.execute("ALTER TABLE backups ADD COLUMN client TEXT NOT NULL DEFAULT ''")


migrate()


def now() -> int:
    return int(time.time())


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---- sessions --------------------------------------------------------------------------------
def current_account(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> sqlite3.Row:
    return account_for_token(credentials.credentials.strip() if credentials else "")


def account_for_token(token: str) -> sqlite3.Row:
    if not token:
        raise HTTPException(401, "Missing session token")
    with database() as db:
        row = db.execute(
            "SELECT accounts.* FROM sessions JOIN accounts ON accounts.id = sessions.account_id WHERE token_hash = ? AND expires_at > ?",
            (token_hash(token), now()),
        ).fetchone()
    if not row:
        raise HTTPException(401, "Session expired, link again")
    return row


def account_view(row: sqlite3.Row, db: sqlite3.Connection) -> dict[str, Any]:
    read = {r["chat"]: r["last_read"] for r in db.execute("SELECT chat, last_read FROM read_state WHERE account_id = ?", (row["id"],))}
    status = db.execute("SELECT status, hide_last_seen FROM user_status WHERE account_id = ?", (row["id"],)).fetchone()
    return {
        "server": row["server"],
        "user": json.loads(row["profile"]),
        "status": status["status"] if status else "online",
        "hide_last_seen": bool(status["hide_last_seen"]) if status else False,
        "settings": json.loads(row["settings"]),
        "read_state": read,
        "drafts": {r["chat"]: r["text"] for r in db.execute("SELECT chat, text FROM drafts WHERE account_id = ?", (row["id"],))},
        "linked_at": row["created_at"],
    }


# ---- API -------------------------------------------------------------------------------------
class LinkIn(BaseModel):
    server: str = Field(description="Nekochat server base URL the token belongs to")
    device: str = Field(default="", max_length=100)


@app.get("/docs", include_in_schema=False)
def docs_alias():
    return RedirectResponse("/api/docs")


@app.get("/openapi.json", include_in_schema=False)
def openapi_alias():
    return app.openapi()


@app.get("/api/health", tags=["server"])
def health():
    return {"ok": True, "version": VERSION}


@app.get("/api/info", tags=["server"])
def info():
    return {"name": "Nekochat Reloaded companion", "version": VERSION, "servers": NEKOCHAT_SERVERS, "features": ["settings", "read_state", "status"]}


@app.post("/link", tags=["account"])
async def link(payload: LinkIn, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    """Links a Nekochat account: the Nekochat token proves who the user is, once.

    The token is only forwarded to that Nekochat server's /api/me and is not stored.
    """
    server = payload.server.strip().rstrip("/")
    if server not in NEKOCHAT_SERVERS:
        raise HTTPException(400, "This Nekochat server is not supported by this companion")
    nekochat_token = credentials.credentials.strip() if credentials else ""
    if not nekochat_token:
        raise HTTPException(401, "Send the Nekochat token as Authorization: Bearer <token>")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{server}/api/me", headers={"Authorization": f"Bearer {nekochat_token}"})
    except httpx.HTTPError:
        raise HTTPException(502, "The Nekochat server is unreachable")
    if response.status_code in (401, 403):
        raise HTTPException(401, "The Nekochat token is not valid")
    if response.status_code != 200:
        raise HTTPException(502, f"The Nekochat server answered {response.status_code}")
    profile = response.json()
    if not isinstance(profile, dict) or not isinstance(profile.get("id"), int):
        raise HTTPException(502, "Unexpected answer from the Nekochat server")

    session = secrets.token_urlsafe(32)
    with database() as db:
        db.execute(
            "INSERT INTO accounts (server, nekochat_id, profile, created_at, updated_at) VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT (server, nekochat_id) DO UPDATE SET profile = excluded.profile, updated_at = excluded.updated_at",
            (server, profile["id"], json.dumps(profile), now(), now()),
        )
        account = db.execute("SELECT * FROM accounts WHERE server = ? AND nekochat_id = ?", (server, profile["id"])).fetchone()
        db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now(),))
        db.execute(
            "INSERT INTO sessions (token_hash, account_id, device, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
            (token_hash(session), account["id"], payload.device[:100], now(), now() + SESSION_DAYS * 86400),
        )
        return {"token": session, "expires_in": SESSION_DAYS * 86400, **account_view(account, db)}


@app.get("/me", tags=["account"])
def me(account: sqlite3.Row = Depends(current_account)):
    """Everything the client keeps here, in one package."""
    with database() as db:
        return account_view(account, db)


@app.put("/settings", tags=["sync"])
def put_settings(settings: dict[str, Any], account: sqlite3.Row = Depends(current_account)):
    """Replaces the synced client settings (muted chats, sounds, background, ...)."""
    text = json.dumps(settings, separators=(",", ":"))
    if len(text.encode()) > MAX_SETTINGS_BYTES:
        raise HTTPException(413, "Settings are too large")
    with database() as db:
        db.execute("UPDATE accounts SET settings = ?, updated_at = ? WHERE id = ?", (text, now(), account["id"]))
    return {"ok": True, "settings": settings}


class ReadStateIn(BaseModel):
    # chat → id of the last message read there, e.g. {"room:5": "123", "dm:2": "88"}
    chats: dict[str, str | int]


@app.get("/read-state", tags=["sync"])
def get_read_state(account: sqlite3.Row = Depends(current_account)):
    with database() as db:
        return {r["chat"]: r["last_read"] for r in db.execute("SELECT chat, last_read FROM read_state WHERE account_id = ?", (account["id"],))}


@app.put("/read-state", tags=["sync"])
def put_read_state(payload: ReadStateIn, account: sqlite3.Row = Depends(current_account)):
    """Stores the last read message per chat, so every device shows the same unread counts."""
    chats = {chat: str(value) for chat, value in payload.chats.items() if chat.split(":")[0] in ("room", "dm") and len(chat) <= 40 and len(str(value)) <= 64}
    with database() as db:
        known = {r["chat"] for r in db.execute("SELECT chat FROM read_state WHERE account_id = ?", (account["id"],))}
        if len(known | set(chats)) > MAX_READ_STATE_CHATS:
            raise HTTPException(413, "Too many chats")
        db.executemany(
            "INSERT INTO read_state (account_id, chat, last_read, updated_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT (account_id, chat) DO UPDATE SET last_read = excluded.last_read, updated_at = excluded.updated_at",
            [(account["id"], chat, value, now()) for chat, value in chats.items()],
        )
        invisible = is_invisible(db, account["id"])
    # Read receipts: the other person of a direct chat learns what you have read (not while invisible).
    if not invisible:
        for chat, value in chats.items():
            if chat.startswith("dm:") and chat[3:].isdigit():
                publish(account["server"], {"type": "read", "chat": shared_chat(chat, account), "user": account["nekochat_id"], "last_read": value})
    return {"ok": True, "updated": len(chats)}


STATUSES = ("online", "away", "dnd", "invisible")


class StatusIn(BaseModel):
    status: str
    client: str | None = Field(default=None, max_length=40, description='The app sending it, e.g. "PC 1.4.1"; kept as it was when omitted')


@app.put("/status", tags=["status"])
def put_status(payload: StatusIn, account: sqlite3.Row = Depends(current_account)):
    """Your own status, seen by other Reloaded users of the same Nekochat server.

    `away` shows a yellow dot, `dnd` a red one; `invisible` makes you look offline to them.
    """
    if payload.status not in STATUSES:
        raise HTTPException(400, f"Status must be one of: {', '.join(STATUSES)}")
    client = (payload.client or "").strip()
    with database() as db:
        db.execute(
            "INSERT INTO user_status (account_id, status, client, updated_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT (account_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at"
            + (", client = excluded.client" if client else ""),
            (account["id"], payload.status, client, now()),
        )
        stored = db.execute("SELECT client FROM user_status WHERE account_id = ?", (account["id"],)).fetchone()
        touch_last_seen(db, account["id"])
    invisible = payload.status == "invisible"
    publish(account["server"], {"type": "status", "id": account["nekochat_id"], "status": "offline" if invisible else payload.status, "client": "" if invisible else (stored["client"] if stored else "")})
    return {"ok": True, "status": payload.status}


@app.get("/statuses", tags=["status"])
def get_statuses(ids: str = "", account: sqlite3.Row = Depends(current_account)):
    """Statuses of the given Nekochat user ids on your server; users who are simply online are omitted.

    An invisible user is reported as `offline`, exactly like someone who is not there.
    """
    wanted = [int(part) for part in ids.split(",") if part.strip().isdigit()][:500]
    if not wanted:
        return {}
    marks = ",".join("?" * len(wanted))
    with database() as db:
        rows = db.execute(
            f"SELECT accounts.nekochat_id, user_status.status FROM user_status JOIN accounts ON accounts.id = user_status.account_id "
            f"WHERE accounts.server = ? AND accounts.nekochat_id IN ({marks}) AND user_status.status != 'online'",
            (account["server"], *wanted),
        ).fetchall()
    return {str(row["nekochat_id"]): "offline" if row["status"] == "invisible" else row["status"] for row in rows}


# ---- live status events ----------------------------------------------------------------------
# Clients keep GET /events open (Server-Sent Events) and learn about status changes at once
# instead of on their next /presence poll. Listeners are grouped by Nekochat server.
_listeners: dict[str, set[tuple[asyncio.Queue, int]]] = {}
_loop: asyncio.AbstractEventLoop | None = None


@app.on_event("startup")
async def remember_loop() -> None:
    global _loop
    _loop = asyncio.get_running_loop()


def publish(server: str, event: dict[str, Any]) -> None:
    """Called from request threads; hands the event to the listeners' event loop.

    Events of a direct chat ("dm:<a>-<b>") go only to its two people, each seeing the chat as
    "dm:<the other one>", the key their client uses."""
    if _loop is None:
        return
    pair = dm_pair(event.get("chat", ""))
    for queue, owner in list(_listeners.get(server, ())):
        if pair and owner not in pair:
            continue
        data = dict(event)
        if pair:
            data["chat"] = f"dm:{pair[1] if owner == pair[0] else pair[0]}"
        _loop.call_soon_threadsafe(lambda q=queue, d=data: q.full() or q.put_nowait(d))


@app.get("/events", tags=["status"], response_class=StreamingResponse,
         responses={200: {"content": {"text/event-stream": {}}, "description": "Events: `status` {id, status, client}, `typing` {chat, user}, `reaction` {chat, message, emoji, user, on}, `pin` {chat, message, content, author, on}, `read` {chat, user, last_read}"}})
async def events(request: Request, token: str = ""):
    """Live status changes (Server-Sent Events). EventSource cannot send headers, so the session
    token goes in `?token=`. Invisible users are reported as `offline` without a client."""
    account = account_for_token(token.strip())
    server = account["server"]
    queue: asyncio.Queue = asyncio.Queue(maxsize=200)
    listener = (queue, account["nekochat_id"])
    _listeners.setdefault(server, set()).add(listener)
    with database() as db:
        touch_last_seen(db, account["id"])

    async def stream():
        try:
            yield "retry: 3000\n\n"
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    kind = event.pop("type", "status")
                    yield f"event: {kind}\ndata: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"  # keeps proxies and the tunnel from closing the stream
        finally:
            _listeners.get(server, set()).discard(listener)
            with database() as db:
                touch_last_seen(db, account["id"])

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---- chats: reactions, pins, typing, read receipts, drafts -------------------------------------
def dm_pair(chat: str) -> tuple[int, int] | None:
    parts = chat[3:].split("-") if chat.startswith("dm:") else []
    return (int(parts[0]), int(parts[1])) if len(parts) == 2 and all(p.isdigit() for p in parts) else None


def shared_chat(chat: str, account: sqlite3.Row) -> str:
    """The client's key ("room:5", "dm:<other id>") → the key both sides share."""
    kind, _, target = chat.partition(":")
    if kind == "room" and target.isdigit():
        return f"room:{int(target)}"
    if kind == "dm" and target.isdigit():
        a, b = sorted((int(target), int(account["nekochat_id"])))
        return f"dm:{a}-{b}"
    raise HTTPException(400, 'chat must be "room:<id>" or "dm:<user id>"')


def is_invisible(db: sqlite3.Connection, account_id: int) -> bool:
    row = db.execute("SELECT status FROM user_status WHERE account_id = ?", (account_id,)).fetchone()
    return bool(row and row["status"] == "invisible")


def touch_last_seen(db: sqlite3.Connection, account_id: int) -> None:
    """Remembers when the account was last active; not while it is invisible."""
    if is_invisible(db, account_id):
        return
    db.execute("INSERT INTO user_status (account_id, status, updated_at, last_seen) VALUES (?, 'online', ?, ?) "
               "ON CONFLICT (account_id) DO UPDATE SET last_seen = excluded.last_seen", (account_id, now(), now()))


class PrivacyIn(BaseModel):
    hide_last_seen: bool


@app.put("/privacy", tags=["status"])
def put_privacy(payload: PrivacyIn, account: sqlite3.Row = Depends(current_account)):
    """hide_last_seen: others do not see when you were last online."""
    with database() as db:
        db.execute("INSERT INTO user_status (account_id, status, updated_at, hide_last_seen) VALUES (?, 'online', ?, ?) "
                   "ON CONFLICT (account_id) DO UPDATE SET hide_last_seen = excluded.hide_last_seen", (account["id"], now(), int(payload.hide_last_seen)))
    return {"ok": True, "hide_last_seen": payload.hide_last_seen}


# ---- link previews ---------------------------------------------------------------------------
# The companion fetches the page (browsers cannot, because of CORS) and returns its Open Graph
# title, description and picture. Only public addresses are fetched, never the local network.
_previews: dict[str, tuple[float, dict[str, Any]]] = {}


async def public_address(host: str, port: int) -> str:
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=0)
    except OSError:
        raise HTTPException(400, "Unknown host")
    addresses = {info[4][0] for info in infos}
    if not addresses or not all(ipaddress.ip_address(address.split("%")[0]).is_global for address in addresses):
        raise HTTPException(400, "Only public addresses")
    return sorted(addresses)[0]


def meta(page: str, *names: str) -> str:
    for name in names:
        for pattern in (rf'<meta[^>]+(?:property|name)=["\']{re.escape(name)}["\'][^>]*content=["\']([^"\']*)["\']', rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']{re.escape(name)}["\']'):
            found = re.search(pattern, page, re.I)
            if found and found.group(1).strip():
                return html.unescape(found.group(1).strip())
    return ""


@app.get("/preview", tags=["chats"])
async def link_preview(url: str, account: sqlite3.Row = Depends(current_account)):
    """{url, title, description, image, site} of a public web page, cached for an hour."""
    cached = _previews.get(url)
    if cached and cached[0] > time.time():
        return cached[1]
    target = url
    async with httpx.AsyncClient(timeout=6, follow_redirects=False, headers={"User-Agent": "NekochatReloadedPreview/1.0 (+https://github.com/xKaMikax/nekochat_reloaded)"}) as client:
        for _ in range(4):
            parsed = urlparse(target)
            if parsed.scheme not in ("http", "https") or not parsed.hostname or len(target) > 2000:
                raise HTTPException(400, "Only http and https links")
            address = await public_address(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
            # Plain http goes to the checked address itself, so DNS cannot change it in between;
            # https keeps the name (a certificate would not match a private service anyway).
            request_url = target if parsed.scheme == "https" else parsed._replace(netloc=f"[{address}]:{parsed.port or 80}" if ":" in address else f"{address}:{parsed.port or 80}").geturl()
            async with client.stream("GET", request_url, headers={"Host": parsed.netloc} if parsed.scheme == "http" else {}) as response:
                if response.status_code in (301, 302, 303, 307, 308) and response.headers.get("location"):
                    target = urljoin(target, response.headers["location"])
                    continue
                if response.status_code != 200 or "html" not in response.headers.get("content-type", ""):
                    raise HTTPException(422, "No preview for this link")
                body = b""
                async for chunk in response.aiter_bytes():
                    body += chunk
                    if len(body) > 512 * 1024:
                        break
                break
        else:
            raise HTTPException(422, "Too many redirects")
    page = body.decode(response.encoding or "utf-8", errors="replace")
    title_tag = re.search(r"<title[^>]*>(.*?)</title>", page, re.I | re.S)
    image = meta(page, "og:image", "twitter:image")
    image = urljoin(target, image) if image else ""
    result = {"url": target, "title": (meta(page, "og:title", "twitter:title") or (html.unescape(title_tag.group(1).strip()) if title_tag else ""))[:200],
              "description": meta(page, "og:description", "twitter:description", "description")[:300],
              "image": image if urlparse(image).scheme in ("http", "https") else "", "site": meta(page, "og:site_name")[:80] or urlparse(target).hostname or ""}
    if len(_previews) > 500:
        _previews.clear()
    _previews[url] = (time.time() + 3600, result)
    return result


@app.get("/chat", tags=["chats"])
def get_chat(chat: str, account: sqlite3.Row = Depends(current_account)):
    """Reactions `{message: {emoji: [user ids]}}`, pins (newest first) and, in a direct chat, the
    id of the last message the other person read (hidden while they are invisible)."""
    shared = shared_chat(chat, account)
    with database() as db:
        reactions: dict[str, dict[str, list[int]]] = {}
        for r in db.execute("SELECT message, emoji, nekochat_id FROM reactions WHERE server = ? AND chat = ? ORDER BY created_at", (account["server"], shared)):
            reactions.setdefault(r["message"], {}).setdefault(r["emoji"], []).append(r["nekochat_id"])
        pins = [dict(message=r["message"], content=r["content"], author=r["author"], pinned_by=r["pinned_by"], at=r["created_at"])
                for r in db.execute("SELECT * FROM pins WHERE server = ? AND chat = ? ORDER BY created_at DESC", (account["server"], shared))]
        read = None
        pair = dm_pair(shared)
        if pair:
            other = pair[1] if pair[0] == account["nekochat_id"] else pair[0]
            row = db.execute("SELECT accounts.id, read_state.last_read FROM accounts JOIN read_state ON read_state.account_id = accounts.id "
                             "WHERE accounts.server = ? AND accounts.nekochat_id = ? AND read_state.chat = ?", (account["server"], other, f"dm:{account['nekochat_id']}")).fetchone()
            if row and not is_invisible(db, row["id"]):
                read = row["last_read"]
    return {"chat": chat, "reactions": reactions, "pins": pins, "read": read}


class ReactionIn(BaseModel):
    chat: str = Field(max_length=40)
    message: str = Field(max_length=64)
    emoji: str = Field(min_length=1, max_length=16)
    on: bool = True


@app.put("/reactions", tags=["chats"])
def put_reaction(payload: ReactionIn, account: sqlite3.Row = Depends(current_account)):
    shared = shared_chat(payload.chat, account)
    with database() as db:
        if payload.on:
            if db.execute("SELECT COUNT(DISTINCT emoji) FROM reactions WHERE server = ? AND chat = ? AND message = ?", (account["server"], shared, payload.message)).fetchone()[0] >= 20:
                raise HTTPException(409, "Too many different reactions on this message")
            db.execute("INSERT OR IGNORE INTO reactions VALUES (?, ?, ?, ?, ?, ?)", (account["server"], shared, payload.message, account["nekochat_id"], payload.emoji, now()))
        else:
            db.execute("DELETE FROM reactions WHERE server = ? AND chat = ? AND message = ? AND nekochat_id = ? AND emoji = ?", (account["server"], shared, payload.message, account["nekochat_id"], payload.emoji))
    publish(account["server"], {"type": "reaction", "chat": shared, "message": payload.message, "emoji": payload.emoji, "user": account["nekochat_id"], "on": payload.on})
    return {"ok": True}


class PinIn(BaseModel):
    chat: str = Field(max_length=40)
    message: str = Field(max_length=64)
    content: str = Field(default="", max_length=300)
    author: str = Field(default="", max_length=80)
    on: bool = True


@app.put("/pins", tags=["chats"])
def put_pin(payload: PinIn, account: sqlite3.Row = Depends(current_account)):
    shared = shared_chat(payload.chat, account)
    with database() as db:
        if payload.on:
            if db.execute("SELECT COUNT(*) FROM pins WHERE server = ? AND chat = ?", (account["server"], shared)).fetchone()[0] >= 50:
                raise HTTPException(409, "A chat can have at most 50 pinned messages")
            db.execute("INSERT OR REPLACE INTO pins VALUES (?, ?, ?, ?, ?, ?, ?)", (account["server"], shared, payload.message, payload.content, payload.author, account["nekochat_id"], now()))
        else:
            db.execute("DELETE FROM pins WHERE server = ? AND chat = ? AND message = ?", (account["server"], shared, payload.message))
    publish(account["server"], {"type": "pin", "chat": shared, "message": payload.message, "content": payload.content, "author": payload.author, "on": payload.on, "user": account["nekochat_id"]})
    return {"ok": True}


class ChatIn(BaseModel):
    chat: str = Field(max_length=40)


@app.post("/typing", tags=["chats"])
def post_typing(payload: ChatIn, account: sqlite3.Row = Depends(current_account)):
    """"… is typing": clients send it at most every few seconds while typing. Not sent on while invisible."""
    shared = shared_chat(payload.chat, account)
    with database() as db:
        if is_invisible(db, account["id"]):
            return {"ok": True}
    publish(account["server"], {"type": "typing", "chat": shared, "user": account["nekochat_id"]})
    return {"ok": True}


class DraftIn(BaseModel):
    chat: str = Field(max_length=40)
    text: str = Field(default="", max_length=4000)


@app.put("/drafts", tags=["sync"])
def put_draft(payload: DraftIn, account: sqlite3.Row = Depends(current_account)):
    """The unsent text of a chat, shared by your devices; empty text removes it."""
    shared_chat(payload.chat, account)
    with database() as db:
        if payload.text.strip():
            if db.execute("SELECT COUNT(*) FROM drafts WHERE account_id = ? AND chat != ?", (account["id"], payload.chat)).fetchone()[0] >= 200:
                raise HTTPException(413, "Too many drafts")
            db.execute("INSERT INTO drafts VALUES (?, ?, ?, ?) ON CONFLICT (account_id, chat) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at", (account["id"], payload.chat, payload.text, now()))
        else:
            db.execute("DELETE FROM drafts WHERE account_id = ? AND chat = ?", (account["id"], payload.chat))
    return {"ok": True}


@app.get("/drafts", tags=["sync"])
def get_drafts(account: sqlite3.Row = Depends(current_account)):
    with database() as db:
        return {r["chat"]: r["text"] for r in db.execute("SELECT chat, text FROM drafts WHERE account_id = ?", (account["id"],))}


@app.get("/presence", tags=["status"])
def get_presence(ids: str = "", account: sqlite3.Row = Depends(current_account)):
    """Status and client app of the given Nekochat user ids on your server, for users who use a Reloaded client.

    Each entry is `{"status": ..., "client": "Android 1.4.1"}`. An invisible user is reported as
    `offline` without a client, exactly like someone who is not there.
    """
    wanted = [int(part) for part in ids.split(",") if part.strip().isdigit()][:500]
    if not wanted:
        return {}
    marks = ",".join("?" * len(wanted))
    with database() as db:
        rows = db.execute(
            f"SELECT accounts.nekochat_id, user_status.status, user_status.client, user_status.last_seen, user_status.hide_last_seen FROM user_status JOIN accounts ON accounts.id = user_status.account_id "
            f"WHERE accounts.server = ? AND accounts.nekochat_id IN ({marks})",
            (account["server"], *wanted),
        ).fetchall()
    seen = lambda row: 0 if row["hide_last_seen"] else row["last_seen"]
    return {str(row["nekochat_id"]): {"status": "offline", "client": "", "last_seen": seen(row)} if row["status"] == "invisible" else {"status": row["status"], "client": row["client"], "last_seen": seen(row)} for row in rows}


# ---- backups ---------------------------------------------------------------------------------
def backup_path(backup_id: str) -> Path:
    return BACKUPS / f"{backup_id}.zip"


def backup_view(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "name": row["name"], "device": row["device"], "client": row["client"], "size": row["size"], "sha256": row["sha256"], "created_at": row["created_at"]}


def owned_backup(backup_id: str, account: sqlite3.Row, db: sqlite3.Connection) -> sqlite3.Row:
    row = db.execute("SELECT * FROM backups WHERE id = ? AND account_id = ?", (backup_id, account["id"])).fetchone()
    if not row or not backup_path(row["id"]).is_file():
        raise HTTPException(404, "Backup not found")
    return row


@app.get("/backups", tags=["backups"])
def list_backups(account: sqlite3.Row = Depends(current_account)):
    """The account's backups, newest first."""
    with database() as db:
        rows = db.execute("SELECT * FROM backups WHERE account_id = ? ORDER BY created_at DESC, rowid DESC", (account["id"],)).fetchall()
    return {"backups": [backup_view(row) for row in rows], "limit": MAX_BACKUPS, "max_bytes": MAX_BACKUP_BYTES}


@app.post("/backups", tags=["backups"], status_code=201,
          openapi_extra={"requestBody": {"required": True, "content": {"application/zip": {"schema": {"type": "string", "format": "binary"}}}}})
async def create_backup(request: Request, name: str = "", device: str = "", client: str = "", account: sqlite3.Row = Depends(current_account)):
    """Stores the request body (a zip archive) as a new backup. `client` names the app that made it, e.g. `PC 1.3.1`."""
    with database() as db:
        count = db.execute("SELECT COUNT(*) FROM backups WHERE account_id = ?", (account["id"],)).fetchone()[0]
    if count >= MAX_BACKUPS:
        raise HTTPException(409, f"You already have {MAX_BACKUPS} backups; delete one first")
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > MAX_BACKUP_BYTES:
            raise HTTPException(413, f"The backup is larger than {MAX_BACKUP_BYTES // (1024 * 1024)} MB")
    if not data.startswith(b"PK\x03\x04"):
        raise HTTPException(400, "The backup must be a zip archive")
    backup_id = secrets.token_hex(12)
    BACKUPS.mkdir(parents=True, exist_ok=True)
    temporary = BACKUPS / f"{backup_id}.part"
    temporary.write_bytes(data)
    temporary.replace(backup_path(backup_id))
    name = name.strip()[:80] or time.strftime("Backup %Y-%m-%d %H:%M", time.gmtime())
    with database() as db:
        db.execute("INSERT INTO backups (id, account_id, name, device, client, size, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                   (backup_id, account["id"], name, device.strip()[:80], client.strip()[:40], len(data), hashlib.sha256(data).hexdigest(), now()))
        row = db.execute("SELECT * FROM backups WHERE id = ?", (backup_id,)).fetchone()
    return backup_view(row)


@app.get("/backups/{backup_id}", tags=["backups"], response_class=FileResponse,
         responses={200: {"content": {"application/zip": {}}, "description": "The zip archive"}})
def download_backup(backup_id: str, account: sqlite3.Row = Depends(current_account)):
    with database() as db:
        row = owned_backup(backup_id, account, db)
    return FileResponse(backup_path(row["id"]), media_type="application/zip", filename=f"{row['name']}.zip")


@app.delete("/backups/{backup_id}", tags=["backups"])
def delete_backup(backup_id: str, account: sqlite3.Row = Depends(current_account)):
    with database() as db:
        row = owned_backup(backup_id, account, db)
        db.execute("DELETE FROM backups WHERE id = ?", (row["id"],))
    backup_path(row["id"]).unlink(missing_ok=True)
    return {"ok": True}


@app.post("/logout", tags=["account"])
def logout(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    token = credentials.credentials.strip() if credentials else ""
    with database() as db:
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))
    return {"ok": True}


@app.delete("/me", tags=["account"])
def delete_me(account: sqlite3.Row = Depends(current_account)):
    """Forgets everything this server keeps about the account (sessions, settings, read state, backups)."""
    with database() as db:
        files = [row["id"] for row in db.execute("SELECT id FROM backups WHERE account_id = ?", (account["id"],))]
        db.execute("DELETE FROM accounts WHERE id = ?", (account["id"],))
    for backup_id in files:
        backup_path(backup_id).unlink(missing_ok=True)
    return {"ok": True}
