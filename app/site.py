"""The website of Nekochat Reloaded (site/public, built by site/build.py): a home page in the style of the early 2000s,
served by this server at /, in English and Russian (/ru/). Three pages are filled in when served (home, download, status);
GET /counter.svg is the visitor counter."""
from __future__ import annotations

import datetime
import html
import time
from pathlib import Path

import httpx
from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

SITE = Path(__file__).resolve().parent.parent / "site" / "public"
RELEASES = "https://api.github.com/repos/xKaMikax/nekochat_reloaded/releases/latest"
router = APIRouter()
_started = time.time()
_latest: dict = {"at": 0.0, "data": None}
_seen: dict[str, float] = {}


async def latest_release() -> dict | None:
    """The latest stable release from GitHub, asked at most once an hour (a failed answer is kept for a few minutes)."""
    if time.time() - _latest["at"] < 3600 and _latest["data"] is not None:
        return _latest["data"]
    if time.time() - _latest["at"] < 300:
        return _latest["data"]
    _latest["at"] = time.time()
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            answer = await client.get(RELEASES, headers={"Accept": "application/vnd.github+json"})
        if answer.status_code == 200:
            _latest["data"] = answer.json()
    except httpx.HTTPError:
        pass
    return _latest["data"]


def uptime_text(ru: bool) -> str:
    seconds = int(time.time() - _started)
    days, rest = divmod(seconds, 86400)
    hours, rest = divmod(rest, 3600)
    minutes = rest // 60
    return (f"{days} д {hours} ч {minutes} мин" if ru else f"{days} d {hours} h {minutes} min")


async def tokens(page: str, ru: bool) -> dict[str, str]:
    from . import main   # the data lives in the main module
    values: dict[str, str] = {}
    release = await latest_release()
    if release:
        name = html.escape(release.get("name") or release.get("tag_name") or "")
        url = html.escape(release.get("html_url") or "")
        date = (release.get("published_at") or "")[:10]
        values["LATEST_LINE"] = (f"Новый выпуск: {name}!" if ru else f"New release: {name}!")
        values["LATEST_BOX"] = (f'<b><a href="{url}">{name}</a></b> — {date}.' if ru else f'<b><a href="{url}">{name}</a></b> - published {date}.')
    else:
        values["LATEST_LINE"] = "Скачайте последнюю версию!" if ru else "Get the latest version!"
        values["LATEST_BOX"] = ('См. <a href="https://github.com/xKaMikax/nekochat_reloaded/releases/latest">страницу выпуска</a>.' if ru
                                else 'See the <a href="https://github.com/xKaMikax/nekochat_reloaded/releases/latest">release page</a>.')
    if page == "status":
        with main.database() as db:
            accounts = db.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
            scores = db.execute("SELECT COUNT(*) FROM game_scores").fetchone()[0]
            files, size = db.execute("SELECT COUNT(*), COALESCE(SUM(size), 0) FROM files").fetchone()
        values.update({
            "STATE": "Сервер работает" if ru else "The server is running",
            "VERSION": main.VERSION, "UPTIME": uptime_text(ru),
            "SERVERS": ", ".join(html.escape(s) for s in main.NEKOCHAT_SERVERS),
            "ACCOUNTS": str(accounts), "SCORES": str(scores), "FILES": str(files), "FILES_MB": f"{size / 1048576:.1f}",
            "GAMES": str(sum(1 for g in main._games.values() if not g["closed"])),
            "NOW": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        })
    return values


async def dynamic(name: str, ru: bool) -> Response:
    path = SITE / ("ru" if ru else "") / f"{name}.html"
    if not path.is_file():
        return Response(status_code=404)
    text = path.read_text(encoding="utf-8")
    for key, value in (await tokens(name, ru)).items():
        text = text.replace("{{" + key + "}}", value)
    return HTMLResponse(text, headers={"Cache-Control": "no-cache"})


@router.get("/", include_in_schema=False)
@router.get("/index.html", include_in_schema=False)
async def home() -> Response:
    return await dynamic("index", False)


@router.get("/ru", include_in_schema=False)
@router.get("/ru/", include_in_schema=False)
@router.get("/ru/index.html", include_in_schema=False)
async def home_ru() -> Response:
    return await dynamic("index", True)


@router.get("/download.html", include_in_schema=False)
async def download() -> Response:
    return await dynamic("download", False)


@router.get("/ru/download.html", include_in_schema=False)
async def download_ru() -> Response:
    return await dynamic("download", True)


@router.get("/status.html", include_in_schema=False)
async def status() -> Response:
    return await dynamic("status", False)


@router.get("/ru/status.html", include_in_schema=False)
async def status_ru() -> Response:
    return await dynamic("status", True)


@router.get("/counter.svg", include_in_schema=False)
def counter(request: Request) -> Response:
    """The visitor counter: one more for a visitor (by address) at most every 30 minutes."""
    from . import main
    ip = request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "?")
    now = time.time()
    with main.database() as db:
        db.execute("CREATE TABLE IF NOT EXISTS site_counter (id INTEGER PRIMARY KEY CHECK (id = 1), hits INTEGER NOT NULL)")
        db.execute("INSERT OR IGNORE INTO site_counter (id, hits) VALUES (1, 0)")
        if now - _seen.get(ip, 0) > 1800:
            db.execute("UPDATE site_counter SET hits = hits + 1 WHERE id = 1")
            _seen[ip] = now
            if len(_seen) > 5000:
                for key in [k for k, t in _seen.items() if now - t > 1800]:
                    _seen.pop(key, None)
        hits = db.execute("SELECT hits FROM site_counter WHERE id = 1").fetchone()[0]
    digits = f"{hits:06d}"
    cells = "".join(
        f'<rect x="{1 + i * 15}" y="1" width="14" height="20" fill="#000"/>'
        f'<text x="{8 + i * 15}" y="17" text-anchor="middle" font-family="Courier New, monospace" font-weight="bold" font-size="17" fill="#33ff33">{d}</text>'
        for i, d in enumerate(digits))
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="22"><rect width="96" height="22" fill="#808080"/>{cells}</svg>'
    return Response(svg, media_type="image/svg+xml", headers={"Cache-Control": "no-store"})


class SiteFiles(StaticFiles):
    """Static files that a browser (and the CDN in front of the server) asks about again every time, except the pictures."""
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=3600" if path.startswith("img/") else "no-cache"
        return response


def install(app: FastAPI) -> None:
    """Adds the site's routes; the static files go last, so no API path is covered."""
    app.include_router(router)
    app.mount("/", SiteFiles(directory=SITE, html=True), name="site")
