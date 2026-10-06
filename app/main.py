"""Nekochat Reloaded companion server.

Adds what the Nekochat Reloaded clients need beyond the Nekochat server: settings and
read state shared between a user's devices ("memory"), and room for new features.
It does not replace or proxy the Nekochat API. The only call to the Nekochat server is
GET /api/me during /link, to learn who the owner of a Nekochat token is.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
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

VERSION = "0.13.0"
# Nekochat servers this companion accepts accounts from (comma-separated base URLs).
NEKOCHAT_SERVERS = [url.strip().rstrip("/") for url in os.environ.get("NEKOCHAT_SERVERS", "https://nekochat.komdu.is-cool.dev").split(",") if url.strip()]
DATABASE = Path(os.environ.get("RELOADED_DB", "reloaded.db"))
SESSION_DAYS = int(os.environ.get("RELOADED_SESSION_DAYS", "30"))
MAX_SETTINGS_BYTES = 64 * 1024
MAX_READ_STATE_CHATS = 2000
BACKUPS = Path(os.environ.get("RELOADED_BACKUPS", str(DATABASE.resolve().parent / "backups")))
MAX_BACKUP_BYTES = int(os.environ.get("RELOADED_BACKUP_MB", "50")) * 1024 * 1024
MAX_BACKUPS = int(os.environ.get("RELOADED_MAX_BACKUPS", "10"))
# Infinity Memory: files kept for good next to a chat message (the file is also sent live over the Nekochat server).
FILES = Path(os.environ.get("RELOADED_FILES", str(DATABASE.resolve().parent / "files")))
MAX_FILE_BYTES = int(os.environ.get("RELOADED_FILE_MB", "50")) * 1024 * 1024
MAX_FILES_BYTES = int(os.environ.get("RELOADED_FILES_TOTAL_MB", "500")) * 1024 * 1024

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
    {"name": "scores", "description": "The high scores of games with a single high score table (3D Pinball): one best score per user, per Nekochat server"},
    {"name": "games", "description": "Games between users (Reversi, Checkers, Backgammon, Hearts, Spades...): sessions with an ordered log of moves"},
    {"name": "files", "description": "Infinity Memory: files (up to 50 MB) kept on this server, shared by a link nobody can guess"},
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
            CREATE TABLE IF NOT EXISTS game_scores (
                game TEXT NOT NULL,              -- the add-on's id, e.g. "pinball"
                server TEXT NOT NULL,            -- Nekochat server base URL
                nekochat_id INTEGER NOT NULL,    -- the player's user id on that server
                score INTEGER NOT NULL,          -- the best score of that player
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (game, server, nekochat_id)
            );
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,             -- random; also the file name in the files folder
                secret_hash TEXT NOT NULL,       -- sha256 of the secret in the download link
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                mime TEXT NOT NULL,
                size INTEGER NOT NULL,
                sha256 TEXT NOT NULL,
                created_at INTEGER NOT NULL
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
    return {"name": "Nekochat Reloaded companion", "version": VERSION, "servers": NEKOCHAT_SERVERS, "features": ["settings", "read_state", "status", "games", "scores", "files"]}


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
    audience = event.get("_to")  # a list of user ids: only they get the event (never sent on)
    for queue, owner in list(_listeners.get(server, ())):
        if pair and owner not in pair:
            continue
        if audience is not None and owner not in audience:
            continue
        data = {key: value for key, value in event.items() if key != "_to"}
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
                    # keeps proxies and the tunnel from closing the stream; a real event, so that clients (EventSource
                    # shows no comments) can tell a live stream from one that silently died
                    yield ": ping\n\nevent: ping\ndata: {}\n\n"
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


# ---- games ------------------------------------------------------------------------------------
# A game is a session with an ordered log. Clients send moves as entries ({kind, payload}); the server
# numbers them (seq), keeps them and passes them on live over /events, so everyone replays the same
# log and a player who joins late (or reopens the window) catches up with GET /games/<id>. The server
# knows no game rules. An entry can be addressed to some players only (`to`): that is how a dealer
# hands out hidden cards. Sessions live in memory and end after a few hours without moves.
GAME_TTL = 6 * 3600
MAX_GAME_ENTRIES = 3000
MAX_GAME_PAYLOAD = 6000
MAX_GAME_PLAYERS = 8
MAX_OPEN_GAMES = 5
_games: dict[str, dict[str, Any]] = {}
_game_rate: dict[int, list[float]] = {}


def sweep_games() -> None:
    limit = time.time() - GAME_TTL
    for game_id in [key for key, game in _games.items() if game["touched"] < limit or (game["closed"] and game["touched"] < time.time() - 60)]:
        _games.pop(game_id, None)


def player_name(account: sqlite3.Row) -> str:
    profile = json.loads(account["profile"])
    return str(profile.get("display_name") or profile.get("username") or account["nekochat_id"])[:60]


def game_entry_visible(entry: dict[str, Any], user: int) -> bool:
    return "to" not in entry or user in entry["to"] or entry["from"] == user


def game_for(game_id: str, account: sqlite3.Row) -> dict[str, Any]:
    game = _games.get(game_id)
    if not game or game["server"] != account["server"]:
        raise HTTPException(404, "No such game (it may have ended)")
    return game


def game_view(game: dict[str, Any], user: int, log: bool = True) -> dict[str, Any]:
    view = {"id": game["id"], "game": game["game"], "chat": game["chat"], "host": game["host"], "host_name": game["host_name"], "players": sorted(game["audience"]),
            "closed": game["closed"], "created": game["created"], "seq": game["seq"], "watch": game.get("watch", "")}
    if log:
        view["log"] = [entry for entry in game["log"] if game_entry_visible(entry, user)]
    return view


class GameIn(BaseModel):
    game: str = Field(pattern=r"^[a-z0-9-]{1,40}$", description="The add-on's id, e.g. `reversi`")
    chat: str = Field(max_length=40, description='Where to invite: "dm:<user id>" or "room:<id>"')


class GameEntryIn(BaseModel):
    kind: str = Field(pattern=r"^[a-z0-9_-]{1,24}$")
    payload: Any = None
    to: list[int] | None = Field(default=None, max_length=MAX_GAME_PLAYERS, description="Only these players get the entry (default: everyone in the game)")


@app.post("/games", tags=["games"], status_code=201)
def create_game(payload: GameIn, account: sqlite3.Row = Depends(current_account)):
    """Starts a game and invites the chat: the other person of a direct chat, or the members of a room (the
    invitation goes to every Reloaded user of your server; clients show it to the room's members)."""
    sweep_games()
    me_id = int(account["nekochat_id"])
    kind, _, target = payload.chat.partition(":")
    if kind not in ("dm", "room") or not target.isdigit():
        raise HTTPException(400, 'chat must be "dm:<user id>" or "room:<id>"')
    mine = sorted((game for game in _games.values() if game["host"] == me_id and game["server"] == account["server"] and not game["closed"]), key=lambda game: game["touched"])
    for old in mine[: max(0, len(mine) - MAX_OPEN_GAMES + 1)]:
        old["closed"] = True
        publish(old["server"], {"type": "game_end", "session": old["id"], "_to": sorted(old["audience"])})
    game_id = secrets.token_urlsafe(9)
    name = player_name(account)
    audience = {me_id, int(target)} if kind == "dm" else {me_id}
    _games[game_id] = {"id": game_id, "server": account["server"], "game": payload.game, "chat": payload.chat, "host": me_id, "host_name": name, "audience": audience,
                       "log": [], "seq": 0, "closed": False, "created": now(), "touched": time.time(),
                       "watch": secrets.token_urlsafe(8), "viewers": {}}
    invite = {"type": "game_invite", "session": game_id, "game": payload.game, "from": me_id, "name": name}
    if kind == "dm":
        publish(account["server"], {**invite, "chat": f"dm:{min(me_id, int(target))}-{max(me_id, int(target))}"})
    else:
        publish(account["server"], {**invite, "chat": f"room:{int(target)}"})
    return game_view(_games[game_id], me_id)


@app.get("/games/{game_id}", tags=["games"])
def get_game(game_id: str, account: sqlite3.Row = Depends(current_account)):
    """The game and its log (the entries meant for you), for someone who joins late."""
    return game_view(game_for(game_id, account), int(account["nekochat_id"]))


@app.post("/games/{game_id}/send", tags=["games"])
def send_game_entry(game_id: str, entry: GameEntryIn, account: sqlite3.Row = Depends(current_account)):
    """Adds an entry to the log and passes it on to the players at once. `join` makes you a player."""
    game = game_for(game_id, account)
    me_id = int(account["nekochat_id"])
    if game["closed"]:
        raise HTTPException(409, "This game has ended")
    live = entry.kind == "live"
    # A "live" entry (the position of a ball, a cursor) is passed on at once and never kept in the log.
    stamps = [stamp for stamp in _game_rate.get(me_id, []) if stamp > time.time() - 2]
    if len(stamps) >= (60 if live else 40):
        raise HTTPException(429, "Too many moves at once")
    _game_rate[me_id] = stamps + [time.time()]
    if len(json.dumps(entry.payload)) > (800 if live else MAX_GAME_PAYLOAD):
        raise HTTPException(413, "Entry too large")
    if entry.kind == "join":
        if me_id not in game["audience"] and len(game["audience"]) >= MAX_GAME_PLAYERS:
            raise HTTPException(409, "The game is full")
        game["audience"].add(me_id)
    elif me_id not in game["audience"]:
        raise HTTPException(403, "Join the game first")
    if live:
        game["touched"] = time.time()
        item = {"seq": 0, "from": me_id, "name": player_name(account), "kind": "live", "payload": entry.payload, "at": now()}
        game.setdefault("live", {})[me_id] = {"name": item["name"], "payload": entry.payload, "at": time.time()}   # the latest one, for spectators
        publish(game["server"], {"type": "game", "session": game_id, **item, "_to": sorted(user for user in game["audience"] if user != me_id)})
        return {"seq": 0}
    if len(game["log"]) >= MAX_GAME_ENTRIES:
        raise HTTPException(409, "This game is too long")
    game["seq"] += 1
    item: dict[str, Any] = {"seq": game["seq"], "from": me_id, "name": player_name(account), "kind": entry.kind, "payload": entry.payload, "at": now()}
    audience = sorted(game["audience"])
    if entry.to is not None:
        item["to"] = sorted({int(user) for user in entry.to if int(user) in game["audience"]})
        audience = sorted(set(item["to"]) | {me_id})
    game["log"].append(item)
    game["touched"] = time.time()
    publish(game["server"], {"type": "game", "session": game_id, **item, "_to": audience})
    return {"seq": item["seq"]}


def spectator_game(watch_id: str) -> dict[str, Any] | None:
    return next((game for game in _games.values() if game.get("watch") == watch_id), None)


@app.get("/live", tags=["games"])
def live_games(server: str = ""):
    """The games being played now, for spectators (no sign-in): the id to watch each one by (`watch`, see /watch/{watch}),
    the add-on it is played with, how many play and for how long. `server` keeps the games of one Nekochat server."""
    sweep_games()
    wanted = server.strip().rstrip("/")
    return {"games": [{"watch": game["watch"], "game": game["game"], "players": len(game["audience"]), "moves": game["seq"], "created": game["created"], "server": game["server"]}
                      for game in sorted(_games.values(), key=lambda g: g["created"]) if not game["closed"] and game.get("watch") and (not wanted or game["server"] == wanted)]}


@app.get("/watch/{watch_id}", include_in_schema=False)
async def watch_game(watch_id: str, request: Request, since: int = 0, wait: float = 0):
    """What a spectator may see of a game: its public entries (the ones not addressed to somebody) after `since`.
    The address of a game for spectators is its own random `watch` id, not the session id players use, so
    nobody can join a game from the public page. `wait` (seconds, at most 20) holds the answer until something new arrives."""
    game = spectator_game(watch_id)
    if not game:
        raise HTTPException(404, "No such game (it may have ended)")
    viewer = request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "?")
    deadline = time.time() + min(max(wait, 0.0), 20.0)
    while True:
        game["viewers"][viewer] = time.time()
        entries = [entry for entry in game["log"] if entry["seq"] > since and "to" not in entry]
        if entries or game["closed"] or time.time() >= deadline:
            break
        await asyncio.sleep(0.4)
    watching = sum(1 for seen in game["viewers"].values() if seen > time.time() - 40)
    recent = {str(user): {"name": item["name"], **(item["payload"] if isinstance(item["payload"], dict) else {})}
              for user, item in game.get("live", {}).items() if item["at"] > time.time() - 10}
    return {"game": game["game"], "closed": game["closed"], "created": game["created"], "host": game["host"], "hostName": game["host_name"],
            "seq": game["seq"], "watching": watching, "entries": entries, "live": recent}


@app.delete("/games/{game_id}", tags=["games"])
def end_game(game_id: str, account: sqlite3.Row = Depends(current_account)):
    """Ends the game (the host, or anyone in a game of two)."""
    game = game_for(game_id, account)
    me_id = int(account["nekochat_id"])
    if me_id != game["host"] and me_id not in game["audience"]:
        raise HTTPException(403, "Not your game")
    if not game["closed"]:
        game["closed"] = True
        game["touched"] = time.time()
        publish(game["server"], {"type": "game_end", "session": game_id, "_to": sorted(game["audience"])})
    return {"ok": True}


# ---- high scores ------------------------------------------------------------------------------
# One best score per user and game, shared by everyone on the same Nekochat server. A row belongs to
# the user id, and the name shown is the user's display name (from the profile the server holds).
SCORE_GAMES = {"pinball"}
MAX_SCORE = 2_000_000_000


class ScoreIn(BaseModel):
    score: int = Field(ge=0, le=MAX_SCORE, description="The score of the game just played")


def score_game(game: str) -> str:
    if game not in SCORE_GAMES:
        raise HTTPException(404, "This game has no high scores")
    return game


def score_table(game: str, account: sqlite3.Row, limit: int, only: set[int] | None = None) -> dict[str, Any]:
    me_id = int(account["nekochat_id"])
    with database() as db:
        rows = db.execute(
            "SELECT s.nekochat_id, s.score, s.updated_at, a.profile FROM game_scores s "
            "LEFT JOIN accounts a ON a.server = s.server AND a.nekochat_id = s.nekochat_id "
            "WHERE s.game = ? AND s.server = ? ORDER BY s.score DESC, s.updated_at ASC",
            (game, account["server"]),
        ).fetchall()
    entries = []
    if only is not None:
        rows = [row for row in rows if row["nekochat_id"] in only]
    for rank, row in enumerate(rows, 1):
        try:
            profile = json.loads(row["profile"] or "{}")
        except ValueError:
            profile = {}
        entries.append({"rank": rank, "user_id": row["nekochat_id"], "name": str(profile.get("display_name") or profile.get("username") or row["nekochat_id"])[:60], "score": row["score"], "updated_at": row["updated_at"], "me": row["nekochat_id"] == me_id})
    mine = next((entry for entry in entries if entry["me"]), None)
    return {"game": game, "scores": entries[:limit], "me": mine, "players": len(entries)}


@app.get("/scores/{game}", tags=["scores"])
def get_scores(game: str, limit: int = 10, users: str = "", account: sqlite3.Row = Depends(current_account)):
    """The best scores (best first) of everyone on the user's Nekochat server, and the user's own place.
    `users` (comma-separated user ids, e.g. the members of a room) keeps only those players and ranks them among themselves."""
    only = {int(item) for item in users.split(",")[:500] if item.strip().isdigit()} if users.strip() else None
    return score_table(score_game(game), account, max(1, min(limit, 100)), only)


@app.post("/scores/{game}", tags=["scores"])
def post_score(game: str, payload: ScoreIn, account: sqlite3.Row = Depends(current_account)):
    """Sends the score of a finished game. Only the user's best is kept; the answer is the table and whether it is a new best."""
    score_game(game)
    me_id = int(account["nekochat_id"])
    with database() as db:
        row = db.execute("SELECT score FROM game_scores WHERE game = ? AND server = ? AND nekochat_id = ?", (game, account["server"], me_id)).fetchone()
        new_best = payload.score > 0 and (row is None or payload.score > row["score"])
        if new_best:
            db.execute(
                "INSERT INTO game_scores (game, server, nekochat_id, score, updated_at) VALUES (?, ?, ?, ?, ?) "
                "ON CONFLICT(game, server, nekochat_id) DO UPDATE SET score = excluded.score, updated_at = excluded.updated_at",
                (game, account["server"], me_id, payload.score, now()),
            )
    return {"new_best": new_best, **score_table(game, account, 10)}


# ---- files (Infinity Memory) ------------------------------------------------------------------
# A file sent with "Infinity Memory" is also stored here, so a friend who was offline can still get
# it. Whoever has the link (an unguessable secret) can download it; only the owner can list or delete.
def file_path(file_id: str) -> Path:
    return FILES / file_id


def file_view(row: sqlite3.Row, secret: str | None = None) -> dict[str, Any]:
    view = {"id": row["id"], "name": row["name"], "mime": row["mime"], "size": row["size"], "sha256": row["sha256"], "created_at": row["created_at"]}
    if secret:
        view["secret"] = secret
        view["path"] = f"/f/{row['id']}/{secret}"
    return view


@app.post("/files", tags=["files"], status_code=201,
          openapi_extra={"requestBody": {"required": True, "content": {"application/octet-stream": {"schema": {"type": "string", "format": "binary"}}}}})
async def upload_file(request: Request, name: str = "", mime: str = "", account: sqlite3.Row = Depends(current_account)):
    """Stores the request body (up to 50 MB) and answers the link path `/f/<id>/<secret>` to put in a message."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_FILE_BYTES:
        raise HTTPException(413, f"The file is larger than {MAX_FILE_BYTES // (1024 * 1024)} MB")
    with database() as db:
        used = db.execute("SELECT COALESCE(SUM(size), 0) FROM files WHERE account_id = ?", (account["id"],)).fetchone()[0]
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(413, f"The file is larger than {MAX_FILE_BYTES // (1024 * 1024)} MB")
    if not data:
        raise HTTPException(400, "The file is empty")
    if used + len(data) > MAX_FILES_BYTES:
        raise HTTPException(409, f"Your files take {used // (1024 * 1024)} MB of {MAX_FILES_BYTES // (1024 * 1024)} MB; delete some first")
    file_id, secret = secrets.token_hex(8), secrets.token_urlsafe(16)
    FILES.mkdir(parents=True, exist_ok=True)
    temporary = FILES / f"{file_id}.part"
    temporary.write_bytes(data)
    temporary.replace(file_path(file_id))
    clean = "".join(ch for ch in name.strip() if ch not in '/\\\r\n\0')[:120] or "file"
    kind = mime.strip()[:100] if re.fullmatch(r"[\w.+-]+/[\w.+-]+", mime.strip()) else "application/octet-stream"
    with database() as db:
        db.execute("INSERT INTO files (id, secret_hash, account_id, name, mime, size, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                   (file_id, token_hash(secret), account["id"], clean, kind, len(data), hashlib.sha256(data).hexdigest(), now()))
        row = db.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
    return file_view(row, secret)


@app.get("/files", tags=["files"])
def list_files(account: sqlite3.Row = Depends(current_account)):
    with database() as db:
        rows = db.execute("SELECT * FROM files WHERE account_id = ? ORDER BY created_at DESC", (account["id"],)).fetchall()
    return {"files": [file_view(row) for row in rows], "max_bytes": MAX_FILE_BYTES, "total_bytes": MAX_FILES_BYTES, "used_bytes": sum(row["size"] for row in rows)}


@app.delete("/files/{file_id}", tags=["files"])
def delete_file(file_id: str, account: sqlite3.Row = Depends(current_account)):
    with database() as db:
        row = db.execute("SELECT id FROM files WHERE id = ? AND account_id = ?", (file_id, account["id"])).fetchone()
        if not row:
            raise HTTPException(404, "No such file")
        db.execute("DELETE FROM files WHERE id = ?", (file_id,))
    file_path(file_id).unlink(missing_ok=True)
    return {"ok": True}


@app.get("/f/{file_id}/{secret}", tags=["files"], response_class=FileResponse, include_in_schema=True)
def download_file(file_id: str, secret: str):
    """Downloads a file by its link. No sign-in: the secret in the link is the key. Always sent as an attachment."""
    with database() as db:
        row = db.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
    if not row or not hmac.compare_digest(row["secret_hash"], token_hash(secret)) or not file_path(file_id).is_file():
        raise HTTPException(404, "No such file")
    return FileResponse(file_path(file_id), media_type=row["mime"], filename=row["name"], content_disposition_type="attachment",
                        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=86400"})


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
        stored = [row["id"] for row in db.execute("SELECT id FROM files WHERE account_id = ?", (account["id"],))]
        db.execute("DELETE FROM accounts WHERE id = ?", (account["id"],))
    for backup_id in files:
        backup_path(backup_id).unlink(missing_ok=True)
    for file_id in stored:
        file_path(file_id).unlink(missing_ok=True)
    return {"ok": True}


# ---- the website (site/, served at /) -----------------------------------------------------------------
from .site import install as install_site  # noqa: E402  (last: its static files must not cover any API path)
install_site(app)
