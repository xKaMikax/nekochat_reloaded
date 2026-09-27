"""Nekochat Reloaded companion server.

Adds what the Nekochat Reloaded clients need beyond the Nekochat server: settings and
read state shared between a user's devices ("memory"), and room for new features.
It does not replace or proxy the Nekochat API. The only call to the Nekochat server is
GET /api/me during /link, to learn who the owner of a Nekochat token is.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

VERSION = "0.1.0"
# Nekochat servers this companion accepts accounts from (comma-separated base URLs).
NEKOCHAT_SERVERS = [url.strip().rstrip("/") for url in os.environ.get("NEKOCHAT_SERVERS", "https://nekochat.komdu.is-cool.dev").split(",") if url.strip()]
DATABASE = Path(os.environ.get("RELOADED_DB", "reloaded.db"))
SESSION_DAYS = int(os.environ.get("RELOADED_SESSION_DAYS", "30"))
MAX_SETTINGS_BYTES = 64 * 1024
MAX_READ_STATE_CHATS = 2000

app = FastAPI(title="Nekochat Reloaded companion", version=VERSION)
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
            CREATE TABLE IF NOT EXISTS read_state (
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                chat TEXT NOT NULL,              -- "room:<id>" or "dm:<user id>"
                last_read TEXT NOT NULL,         -- id of the last read message
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (account_id, chat)
            );
            """
        )


migrate()


def now() -> int:
    return int(time.time())


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---- sessions --------------------------------------------------------------------------------
def current_account(authorization: str = Header(default="")) -> sqlite3.Row:
    token = authorization.removeprefix("Bearer ").strip()
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
    return {
        "server": row["server"],
        "user": json.loads(row["profile"]),
        "settings": json.loads(row["settings"]),
        "read_state": read,
        "linked_at": row["created_at"],
    }


# ---- API -------------------------------------------------------------------------------------
class LinkIn(BaseModel):
    server: str = Field(description="Nekochat server base URL the token belongs to")
    device: str = Field(default="", max_length=100)


@app.get("/api/health")
def health():
    return {"ok": True, "version": VERSION}


@app.get("/api/info")
def info():
    return {"name": "Nekochat Reloaded companion", "version": VERSION, "servers": NEKOCHAT_SERVERS, "features": ["settings", "read_state"]}


@app.post("/link")
async def link(payload: LinkIn, authorization: str = Header(default="")):
    """Links a Nekochat account: the Nekochat token proves who the user is, once.

    The token is only forwarded to that Nekochat server's /api/me and is not stored.
    """
    server = payload.server.strip().rstrip("/")
    if server not in NEKOCHAT_SERVERS:
        raise HTTPException(400, "This Nekochat server is not supported by this companion")
    nekochat_token = authorization.removeprefix("Bearer ").strip()
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


@app.get("/me")
def me(account: sqlite3.Row = Depends(current_account)):
    """Everything the client keeps here, in one package."""
    with database() as db:
        return account_view(account, db)


@app.put("/settings")
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


@app.get("/read-state")
def get_read_state(account: sqlite3.Row = Depends(current_account)):
    with database() as db:
        return {r["chat"]: r["last_read"] for r in db.execute("SELECT chat, last_read FROM read_state WHERE account_id = ?", (account["id"],))}


@app.put("/read-state")
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
    return {"ok": True, "updated": len(chats)}


@app.post("/logout")
def logout(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    with database() as db:
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))
    return {"ok": True}


@app.delete("/me")
def delete_me(account: sqlite3.Row = Depends(current_account)):
    """Forgets everything this server keeps about the account (sessions, settings, read state)."""
    with database() as db:
        db.execute("DELETE FROM accounts WHERE id = ?", (account["id"],))
    return {"ok": True}
