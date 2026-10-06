"""The website of Nekochat Reloaded (site/public, built by site/build.py): a home page in the style of the early 2000s,
served by this server at /, in English and Russian (/ru/). Three pages are filled in when served (home, download, status);
GET /counter.svg is the visitor counter."""
from __future__ import annotations

import datetime
import html
import time
from pathlib import Path
from urllib.parse import quote, urlencode

import httpx
from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

SITE = Path(__file__).resolve().parent.parent / "site" / "public"
RELEASES = "https://api.github.com/repos/xKaMikax/nekochat_reloaded/releases/latest"
WEBAPP = SITE.parent.parent / "webapp"   # the web version of the client (deployed next to the server, not kept in git)
CATALOG_RAW = "https://raw.githubusercontent.com/xKaMikax/nekochat_reloaded_themes/main"
CATALOG_TREE = "https://github.com/xKaMikax/nekochat_reloaded_themes/tree/main"
PAGE_SIZE = 24
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


_catalog: dict = {"at": 0.0, "items": []}
TYPE_NAMES = {
    "en": {"themes": "Themes", "cursors": "Cursors", "sounds": "Sounds", "wallpapers": "Wallpapers", "icons": "Icons", "assistants": "Assistants", "addons": "Add-ons", "combo": "Combos"},
    "ru": {"themes": "Темы", "cursors": "Курсоры", "sounds": "Звуки", "wallpapers": "Обои", "icons": "Значки", "assistants": "Помощники", "addons": "Дополнения", "combo": "Наборы"},
}


async def catalog_items() -> list[dict]:
    """Everything in the public catalog repository (packs.json and themes.json), asked at most every ten minutes."""
    if time.time() - _catalog["at"] < 600 and _catalog["items"]:
        return _catalog["items"]
    if time.time() - _catalog["at"] < 60:
        return _catalog["items"]
    _catalog["at"] = time.time()
    items: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            packs = (await client.get(f"{CATALOG_RAW}/packs.json")).json().get("packs", [])
            themes = (await client.get(f"{CATALOG_RAW}/themes.json")).json().get("themes", [])
        for theme in themes:
            items.append({"id": theme.get("theme_id", ""), "type": "themes", "name": theme.get("DisplayName", ""), "dir": theme.get("directory", ""),
                          "details": theme.get("Details", {}), "files": None, "includes": None, "platforms": None})
        for pack in packs:
            items.append({"id": pack.get("pack_id", ""), "type": pack.get("type", ""), "name": pack.get("DisplayName", ""), "dir": pack.get("directory", ""),
                          "details": pack.get("Details", {}), "files": pack.get("Files"), "includes": pack.get("Includes"), "platforms": pack.get("Platforms")})
        _catalog["items"] = items
    except (httpx.HTTPError, ValueError):
        pass
    return _catalog["items"]


def catalog_html(items: list[dict], query: dict, ru: bool) -> str:
    names = TYPE_NAMES["ru" if ru else "en"]
    base = "/ru/catalog.html" if ru else "/catalog.html"
    kind = query.get("type", "")
    text = query.get("q", "").strip()[:60]
    try:
        page = max(1, int(query.get("page", "1")))
    except ValueError:
        page = 1
    counts = {k: sum(1 for i in items if i["type"] == k) for k in names}
    out = []
    # the type bar and the search box
    bar = [f'<a href="{base}"><b>{"Все" if ru else "All"}</b></a> ({len(items)})' if not kind else f'<a href="{base}">{"Все" if ru else "All"}</a> ({len(items)})']
    for key, label in names.items():
        if counts.get(key):
            bar.append(f'<b>{label}</b> ({counts[key]})' if key == kind else f'<a href="{base}?type={key}">{label}</a> ({counts[key]})')
    out.append('<p>' + ' | '.join(bar) + '</p>')
    hidden = f'<input type="hidden" name="type" value="{html.escape(kind)}">' if kind else ""
    out.append(f'<form method="get" action="{base}">{hidden}<input type="text" name="q" value="{html.escape(text)}" size="24"> '
               f'<input type="submit" value="{"Найти" if ru else "Search"}"></form>')
    shown = [i for i in items if (not kind or i["type"] == kind) and (not text or text.lower() in (i["name"] + " " + i["id"] + " " + str(i["details"].get("Author", ""))).lower())]
    shown.sort(key=lambda i: str(i["details"].get("Added", "")), reverse=True)
    total = len(shown)
    pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
    page = min(page, pages)
    chunk = shown[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]
    out.append(f'<p class="small">{"Найдено" if ru else "Found"}: <b>{total}</b>. {"Страница" if ru else "Page"} {page} / {pages}.</p>')
    if not items:
        out.append(f'<p class="red">{"Каталог сейчас недоступен, попробуйте позже." if ru else "The catalog is not available right now, please try again later."}</p>')
    rows = []
    for n, item in enumerate(chunk):
        d = item["details"]
        directory = item["dir"]
        preview = ""
        has_preview = item["files"] is None or "Preview.png" in (item["files"] or [])
        if directory and has_preview and item["type"] != "sounds":
            url = f'{CATALOG_RAW}/{quote(directory)}/Preview.png'
            preview = f'<img src="{html.escape(url)}" width="96" alt="" class="shot" onerror="this.style.display=\'none\'">'
        extra = ""
        if item["includes"]:
            extra += "<br><span class='small'>" + ("Состав: " if ru else "Includes: ") + ", ".join(f"{html.escape(names.get(k, k))}: {html.escape(v)}" for k, v in item["includes"].items()) + "</span>"
        if item["platforms"]:
            extra += "<br><span class='small'>" + ("Платформы: " if ru else "Platforms: ") + html.escape(", ".join(item["platforms"])) + "</span>"
        link = f'<a href="{CATALOG_TREE}/{quote(directory)}">{"Файлы" if ru else "Files"}</a>' if directory else ""
        rows.append(
            f'<tr{" class=alt" if n % 2 else ""}><td width="104" align="center">{preview}</td>'
            f'<td><b>{html.escape(item["name"])}</b><br><span class="small">{html.escape(item["id"])} - {html.escape(names.get(item["type"], item["type"]))}</span>{extra}</td>'
            f'<td class="small">{html.escape(str(d.get("Author", "")))}<br>v{html.escape(str(d.get("Version", "")))}<br>{html.escape(str(d.get("Added", "")))}</td>'
            f'<td class="small">{link}</td></tr>')
    if rows:
        head = ("Предпросмотр", "Название", "Автор / версия / добавлено", "") if ru else ("Preview", "Name", "Author / version / added", "")
        out.append('<table class="data"><tr>' + "".join(f"<th>{h}</th>" for h in head) + '</tr>' + "".join(rows) + '</table>')
    elif items:
        out.append(f'<p>{"Ничего не найдено." if ru else "Nothing found."}</p>')
    # page links
    nav = []
    params = {k: v for k, v in (("type", kind), ("q", text)) if v}
    if page > 1:
        nav.append(f'<a href="{base}?{urlencode({**params, "page": page - 1})}">&laquo; {"Назад" if ru else "Previous"}</a>')
    if page < pages:
        nav.append(f'<a href="{base}?{urlencode({**params, "page": page + 1})}">{"Дальше" if ru else "Next"} &raquo;</a>')
    if nav:
        out.append('<p>' + ' | '.join(nav) + '</p>')
    return "\n".join(out)


async def dynamic(name: str, ru: bool, query: dict | None = None) -> Response:
    path = SITE / ("ru" if ru else "") / f"{name}.html"
    if not path.is_file():
        return Response(status_code=404)
    text = path.read_text(encoding="utf-8")
    for key, value in (await tokens(name, ru)).items():
        text = text.replace("{{" + key + "}}", value)
    if name == "catalog":
        text = text.replace("{{CATALOG}}", catalog_html(await catalog_items(), query or {}, ru))
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


@router.get("/catalog.html", include_in_schema=False)
async def catalog(request: Request) -> Response:
    return await dynamic("catalog", False, dict(request.query_params))


@router.get("/ru/catalog.html", include_in_schema=False)
async def catalog_ru(request: Request) -> Response:
    return await dynamic("catalog", True, dict(request.query_params))


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


class WebFiles(StaticFiles):
    """The web version of the client: the start page and the service worker are never kept, the rest is asked about again."""
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "no-store" if path in ("", ".", "index.html", "sw.js") else "no-cache"
        return response


def install(app: FastAPI) -> None:
    """Adds the site's routes; the static files go last, so no API path is covered."""
    app.include_router(router)
    if WEBAPP.is_dir():
        @app.get("/app", include_in_schema=False)
        def app_slash() -> Response:
            return Response(status_code=308, headers={"Location": "/app/"})
        app.mount("/app", WebFiles(directory=WEBAPP, html=True), name="webapp")
    app.mount("/", SiteFiles(directory=SITE, html=True), name="site")
