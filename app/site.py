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
PAGE_SIZE = 40
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


L = {
    "en": {"all": "All", "found": "Found", "page": "Page", "none": "Nothing found.", "down": "The catalog is not available right now, please try again later.",
           "sort": "Sort", "new": "Newest first", "old": "Oldest first", "az": "A - Z", "find": "Find", "search": "Search",
           "author": "Author", "version": "Version", "added": "Added", "type": "Type", "id": "Identifier", "back": "&laquo; Back to the catalog",
           "files": "Files in this pack", "gh": "Open the folder on GitHub", "inc": "This combo contains", "plat": "Platforms",
           "how": "How to install", "steps": "Open <b>Windows Update</b> in the Control Panel of the client (the web version has it too), find this item in the list, tick it and press <b>Review and Install Items</b>.",
           "desc": "Description", "prev": "Previous", "next": "Next", "nop": "no picture", "unknown": "This item is not in the catalog.",
           "intro": "Everything in <b>Nekochat Reloaded Update</b>, live from the public catalog: themes, cursors, sounds, wallpapers, assistants, add-ons and combos. Click an item to see it big, with its files. To install something, open <b>Windows Update</b> in the Control Panel of the client (<a href=\"/app/\">the web version</a> has it too)."},
    "ru": {"all": "Все", "found": "Найдено", "page": "Страница", "none": "Ничего не найдено.", "down": "Каталог сейчас недоступен, попробуйте позже.",
           "sort": "Порядок", "new": "Сначала новые", "old": "Сначала старые", "az": "А - Я", "find": "Найти", "search": "Поиск",
           "author": "Автор", "version": "Версия", "added": "Добавлено", "type": "Вид", "id": "Идентификатор", "back": "&laquo; Назад в каталог",
           "files": "Файлы набора", "gh": "Открыть папку на GitHub", "inc": "В набор входят", "plat": "Платформы",
           "how": "Как установить", "steps": "Откройте <b>Windows Update</b> в Панели управления клиента (в веб-версии он тоже есть), найдите этот пункт в списке, отметьте его и нажмите <b>Review and Install Items</b>.",
           "desc": "Описание", "prev": "Назад", "next": "Дальше", "nop": "нет картинки", "unknown": "Такого пункта нет в каталоге.",
           "intro": "Всё, что есть в <b>Nekochat Reloaded Update</b>, прямо из открытого каталога: темы, курсоры, звуки, обои, помощники, дополнения и наборы. Нажмите на пункт, чтобы увидеть его крупно и список файлов. Чтобы что-то установить, откройте <b>Windows Update</b> в Панели управления клиента (в <a href=\"/app/\">веб-версии</a> он тоже есть)."},
}


def preview_url(item: dict) -> str | None:
    has = item["files"] is None or "Preview.png" in (item["files"] or [])
    if item["dir"] and has and item["type"] != "sounds":
        return f'{CATALOG_RAW}/{quote(item["dir"])}/Preview.png'
    return None


def catalog_detail(item: dict, items: list[dict], ru: bool, description: str) -> str:
    t, names = L["ru" if ru else "en"], TYPE_NAMES["ru" if ru else "en"]
    base = "/ru/catalog.html" if ru else "/catalog.html"
    d = item["details"]
    url = preview_url(item)
    pic = (f'<div class="bigpic"><img src="{html.escape(url)}" alt="" onerror="this.parentNode.innerHTML=\'{t["nop"]}\'"></div>' if url
           else f'<div class="bigpic small">{t["nop"]}</div>')
    rows = [(t["type"], html.escape(names.get(item["type"], item["type"]))), (t["id"], html.escape(item["id"])),
            (t["author"], html.escape(str(d.get("Author", "")))), (t["version"], html.escape(str(d.get("Version", "")))),
            (t["added"], html.escape(str(d.get("Added", ""))))]
    if item["platforms"]:
        rows.append((t["plat"], html.escape(", ".join(item["platforms"]))))
    table = '<table class="data">' + "".join(f'<tr{" class=alt" if n % 2 else ""}><th width="140">{k}</th><td>{v}</td></tr>' for n, (k, v) in enumerate(rows)) + '</table>'
    extra = ""
    if item["includes"]:
        known = {i["id"]: i for i in items}
        parts = []
        for kind, pack_id in item["includes"].items():
            link = f'<a href="{base}?id={quote(pack_id)}">{html.escape(pack_id)}</a>' if pack_id in known else html.escape(pack_id)
            parts.append(f"<li>{html.escape(names.get(kind, kind))}: {link}</li>")
        extra += f'<h2>{t["inc"]}</h2><ul class="arrows">{"".join(parts)}</ul>'
    if item["files"]:
        links = "".join(f'<a href="{CATALOG_RAW}/{quote(item["dir"])}/{quote(name)}">{html.escape(name)}</a><br>' for name in item["files"])
        extra += f'<h2>{t["files"]}</h2><div class="files">{links}</div>'
    if description:
        extra += f'<h2>{t["desc"]}</h2><pre class="desc">{html.escape(description[:4000])}</pre>'
    gh = f'<p><a href="{CATALOG_TREE}/{quote(item["dir"])}">{t["gh"]} &raquo;</a></p>' if item["dir"] else ""
    return (f'<p><a href="{base}">{t["back"]}</a></p><h2 style="margin-top:4px">{html.escape(item["name"])}</h2>'
            f'<table class="detail" cellspacing="0" cellpadding="0"><tr><td width="340">{pic}</td><td style="padding-left:18px">{table}'
            f'<div class="box"><div class="title">{t["how"]}</div><div class="body">{t["steps"]}</div></div>{gh}</td></tr></table>{extra}')


_texts: dict[str, tuple[float, str]] = {}


async def catalog_text(url: str) -> str:
    """A small text file of the catalog (a theme's Description.md), kept for ten minutes."""
    cached = _texts.get(url)
    if cached and time.time() - cached[0] < 600:
        return cached[1]
    text = ""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            answer = await client.get(url)
        if answer.status_code == 200:
            text = answer.text
    except httpx.HTTPError:
        pass
    _texts[url] = (time.time(), text)
    return text


def catalog_html(items: list[dict], query: dict, ru: bool, description: str = "") -> str:
    t, names = L["ru" if ru else "en"], TYPE_NAMES["ru" if ru else "en"]
    base = "/ru/catalog.html" if ru else "/catalog.html"
    if not items:
        return f'<p class="red">{t["down"]}</p>'
    wanted = query.get("id", "")
    if wanted:
        item = next((i for i in items if i["id"] == wanted), None)
        if item:
            return catalog_detail(item, items, ru, description)
        return f'<p><a href="{base}">{t["back"]}</a></p><p class="red">{t["unknown"]}</p>'
    kind = query.get("type", "")
    text = query.get("q", "").strip()[:60]
    sort = query.get("sort", "new")
    try:
        page = max(1, int(query.get("page", "1")))
    except ValueError:
        page = 1
    counts = {k: sum(1 for i in items if i["type"] == k) for k in names}
    keep = {k: v for k, v in (("q", text), ("sort", sort if sort != "new" else "")) if v}

    def link(**extra) -> str:
        params = {**keep, **{k: v for k, v in extra.items() if v}}
        return base + ("?" + urlencode(params) if params else "")
    tabs = [f'<b>{t["all"]} ({len(items)})</b>' if not kind else f'<a href="{link()}">{t["all"]} ({len(items)})</a>']
    for key, label in names.items():
        if counts.get(key):
            tabs.append(f'<b>{label} ({counts[key]})</b>' if key == kind else f'<a href="{link(type=key)}">{label} ({counts[key]})</a>')
    out = [f'<p>{t["intro"]}</p>', '<div class="tabs">' + "".join(tabs) + '</div>']
    hidden = f'<input type="hidden" name="type" value="{html.escape(kind)}">' if kind else ""
    options = "".join(f'<option value="{v}"{" selected" if v == sort else ""}>{t[k]}</option>' for v, k in (("new", "new"), ("old", "old"), ("az", "az")))
    out.append(f'<form class="finder" method="get" action="{base}">{hidden}{t["search"]}: <input type="text" name="q" value="{html.escape(text)}" size="26"> '
               f'{t["sort"]}: <select name="sort">{options}</select> <input type="submit" value="{t["find"]}"></form>')
    shown = [i for i in items if (not kind or i["type"] == kind) and (not text or text.lower() in (i["name"] + " " + i["id"] + " " + str(i["details"].get("Author", ""))).lower())]
    if sort == "az":
        shown.sort(key=lambda i: i["name"].lower())
    else:
        shown.sort(key=lambda i: (str(i["details"].get("Added", "")), i["name"].lower()), reverse=(sort != "old"))
    total = len(shown)
    pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
    page = min(page, pages)
    out.append(f'<p class="small">{t["found"]}: <b>{total}</b>. {t["page"]} {page} / {pages}.</p>')
    cards = []
    for item in shown[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]:
        d = item["details"]
        url = preview_url(item)
        pic = f'<img src="{html.escape(url)}" alt="" onerror="this.style.display=\'none\'">' if url else f'<span class="small">{t["nop"]}</span>'
        cards.append(f'<a class="card" href="{base}?id={quote(item["id"])}"><span class="pic" style="display:block">{pic}</span>'
                     f'<span class="name">{html.escape(item["name"])}</span>'
                     f'<span class="badge">{html.escape(names.get(item["type"], item["type"]))}</span>'
                     f'<span class="meta">{html.escape(str(d.get("Author", "")))} - v{html.escape(str(d.get("Version", "")))}</span></a>')
    out.append('<div class="cards">' + "".join(cards) + '</div>' if cards else f'<p>{t["none"]}</p>')
    if pages > 1:
        bits = []
        if page > 1:
            bits.append(f'<a href="{link(type=kind, page=page - 1)}">&laquo; {t["prev"]}</a>')
        window = sorted({1, pages, *range(max(1, page - 3), min(pages, page + 3) + 1)})
        last = 0
        for n in window:
            if n - last > 1:
                bits.append("...")
            bits.append(f"<b>{n}</b>" if n == page else f'<a href="{link(type=kind, page=n)}">{n}</a>')
            last = n
        if page < pages:
            bits.append(f'<a href="{link(type=kind, page=page + 1)}">{t["next"]} &raquo;</a>')
        out.append('<div class="pager">' + " ".join(bits) + '</div>')
    return "\n".join(out)


async def dynamic(name: str, ru: bool, query: dict | None = None) -> Response:
    path = SITE / ("ru" if ru else "") / f"{name}.html"
    if not path.is_file():
        return Response(status_code=404)
    text = path.read_text(encoding="utf-8")
    for key, value in (await tokens(name, ru)).items():
        text = text.replace("{{" + key + "}}", value)
    if name == "catalog":
        items = await catalog_items()
        description = ""
        wanted = next((i for i in items if i["id"] == (query or {}).get("id")), None)
        if wanted and wanted["type"] == "themes":
            description = await catalog_text(f'{CATALOG_RAW}/{quote(wanted["dir"])}/Description.md')
        text = text.replace("{{CATALOG}}", catalog_html(items, query or {}, ru, description))
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
