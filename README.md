# Nekochat Reloaded companion server

A small server for the Nekochat Reloaded clients. It adds features the Nekochat server does not have — starting with settings and read state shared between a user's devices — without replacing or proxying the Nekochat API.

## How accounts are linked

1. The client signs in to the Nekochat server as usual and gets a Nekochat token.
2. The client calls `POST /link` with that token. The companion checks it once with the Nekochat server's `GET /api/me`, learns the real user, and answers with its **own** session token. The Nekochat token is not stored.
3. Afterwards the client talks to the companion with the companion token only.

Only the Nekochat servers listed in `NEKOCHAT_SERVERS` are accepted.

## API

Interactive docs (Swagger UI): `/api/docs` (alias `/docs`); OpenAPI spec: `/api/openapi.json` (alias `/openapi.json`).

| Method | Path | Body / answer |
|---|---|---|
| GET | `/api/health` | `{ok, version}` |
| GET | `/api/info` | name, version, accepted Nekochat servers, features |
| POST | `/link` | header `Authorization: Bearer <Nekochat token>`, body `{server, device?}` → `{token, expires_in, server, user, settings, read_state}` |
| GET | `/me` | the whole package: `{server, user, settings, read_state, linked_at}` |
| PUT | `/settings` | any JSON object up to 64 KB (muted chats, sounds, background…) |
| GET / PUT | `/read-state` | `{chats: {"room:5": 120, "dm:2": 88}}` — last read message per chat |
| PUT | `/status` | `{status: "online" \| "dnd"}` — your status (do not disturb) |
| GET | `/statuses?ids=1,2,3` | statuses of those Nekochat users on your server (only non-`online` ones) |
| POST | `/logout` | ends this session |
| DELETE | `/me` | forgets the account and everything stored for it |

All endpoints except `/api/*` and `/link` need `Authorization: Bearer <companion token>`.

## Run

```bash
./start.sh            # port 8002; creates .venv on first start (needs uv)
NEKOCHAT_SERVERS=https://nekochat.komdu.is-cool.dev,http://127.0.0.1:8001 ./start.sh 8002
```

Data lives in `reloaded.db` (SQLite, set `RELOADED_DB` to move it).
