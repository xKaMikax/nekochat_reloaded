"""The website of Nekochat Reloaded (site/public, built by site/build.py): a home page in the style of the early 2000s,
served by this server at /, in English and Russian (/ru/). Three pages are filled in when served (home, download, status);
GET /counter.svg is the visitor counter."""
from __future__ import annotations

import datetime
import html
import json
import os
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
CATALOG_RAW = os.environ.get("NEKOCHAT_CATALOG", "https://raw.githubusercontent.com/xKaMikax/nekochat_reloaded_themes/main").rstrip("/")   # a local copy for tests
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


FILE_KINDS = [  # (match, platform key, English label, Russian label, English note, Russian note)
    ("-Setup-", "windows", "Windows - installer", "Windows - установщик", "The easy way: a Windows XP style setup.", "Проще всего: установка в стиле Windows XP."),
    ("-portable.exe", "windows", "Windows - portable", "Windows - портативная", "No installation: run it from any folder.", "Без установки: запуск из любой папки."),
    (".AppImage", "linux", "Linux - AppImage", "Linux - AppImage", "Make the file executable and run it.", "Сделайте файл исполняемым и запустите."),
    (".deb", "linux", "Linux - .deb package", "Linux - пакет .deb", "For Debian and Ubuntu.", "Для Debian и Ubuntu."),
    (".apk", "android", "Android", "Android", "Android 8.0 or later; installs over earlier versions.", "Android 8.0 и новее; ставится поверх прежних версий."),
    (".ipa", "ios", "iPhone / iPad", "iPhone / iPad", "iOS 16.4 or later; not signed - install it with AltStore.", "iOS 16.4 и новее; файл не подписан - ставьте через AltStore."),
]


def platform_of(user_agent: str) -> str:
    ua = user_agent.lower()
    if "android" in ua:
        return "android"
    if "iphone" in ua or "ipad" in ua or "ipod" in ua:
        return "ios"
    if "windows" in ua:
        return "windows"
    if "linux" in ua or "x11" in ua:
        return "linux"
    return ""


def release_files(release: dict | None) -> list[dict]:
    """The downloadable files of a release, in the order of FILE_KINDS (the installer before the portable version)."""
    files = []
    for match, platform, en, ru_label, note_en, note_ru in FILE_KINDS:
        for asset in (release or {}).get("assets", []):
            if match in asset["name"] and not asset["name"].endswith((".blockmap", ".yml")):
                files.append({"name": asset["name"], "url": asset["browser_download_url"], "size": asset["size"], "count": asset.get("download_count", 0),
                              "platform": platform, "label": (en, ru_label), "note": (note_en, note_ru)})
                break
    return files


def downloads_html(release: dict | None, ru: bool, ua: str) -> str:
    files = release_files(release)
    page = ("https://github.com/xKaMikax/nekochat_reloaded/releases/latest")
    if not files:
        return (f'<p><a href="{page}">{"Страница последнего выпуска на GitHub" if ru else "The latest release on GitHub"} &raquo;</a></p>')
    mine = platform_of(ua)
    out = []
    first = next((f for f in files if f["platform"] == mine), None)
    if first:
        out.append(f'<div class="box"><div class="title">{"Для вашей системы" if ru else "For your system"}</div><div class="body">'
                   f'<a class="tile" href="{html.escape(first["url"])}">{"Скачать" if ru else "Download"} {html.escape(first["label"][1 if ru else 0])}'
                   f'<span>{html.escape(first["name"])} - {first["size"] / 1048576:.0f} {"МБ" if ru else "MB"}</span></a></div></div>')
    elif mine == "":
        pass
    head = ("Для чего", "Файл", "Размер", "Примечания") if ru else ("For", "File", "Size", "Notes")
    rows = []
    for n, f in enumerate(files):
        rows.append(f'<tr{" class=alt" if n % 2 else ""}><td><b>{html.escape(f["label"][1 if ru else 0])}</b></td>'
                    f'<td><a href="{html.escape(f["url"])}">{html.escape(f["name"])}</a></td>'
                    f'<td align="right">{f["size"] / 1048576:.0f} {"МБ" if ru else "MB"}</td>'
                    f'<td>{html.escape(f["note"][1 if ru else 0])}</td></tr>')
    rows.append(f'<tr><td><b>{"Браузер" if ru else "Web"}</b></td><td><a href="/app/">{"Открыть веб-версию" if ru else "Open the web version"}</a></td><td align="right">-</td>'
                f'<td>{"Тот же клиент в браузере, ничего ставить не нужно. Работает и на телефоне." if ru else "The same client in your browser, nothing to install. Works on a phone too."}</td></tr>')
    out.append('<table class="data"><tr>' + "".join(f"<th>{h}</th>" for h in head) + "</tr>" + "".join(rows) + "</table>")
    return "".join(out)


def home_download(release: dict | None, ru: bool, ua: str) -> str:
    """The download line of the home page: the file for the visitor's system when it is known."""
    mine = platform_of(ua)
    first = next((f for f in release_files(release) if f["platform"] == mine), None)
    if first:
        return (f'<a href="{html.escape(first["url"])}"><b>{"Скачать" if ru else "Download"} {html.escape(first["label"][1 if ru else 0])}</b></a> '
                f'({first["size"] / 1048576:.0f} {"МБ" if ru else "MB"}). {"Это бесплатно." if ru else "It is free."} '
                f'<a href="download.html">{"Другие системы" if ru else "Other systems"} &raquo;</a>')
    return f'<a href="download.html"><b>{"Скачать прямо сейчас!" if ru else "Download it now!"}</b></a> {"Это бесплатно." if ru else "It is free."}'


GALLERY_IDS = ["pinball-addon", "reversi-addon", "hearts-addon", "spider-addon", "minesweeper-addon", "freecell-addon", "Royale", "Zune"]


def gallery_html(items: list[dict], ru: bool) -> str:
    """A few pictures of games and themes from the catalog for the home page."""
    base = "/ru/catalog.html" if ru else "/catalog.html"
    known = {i["id"]: i for i in items}
    cards = []
    for key in GALLERY_IDS:
        item = known.get(key)
        url = preview_url(item) if item else None
        if item and url:
            cards.append(f'<a class="card" href="{base}?id={quote(item["id"])}"><span class="pic"><img src="{html.escape(url)}" alt=""></span>'
                         f'<span class="name">{html.escape(item["name"])}</span></a>')
    return '<div class="cards">' + "".join(cards) + "</div>" if cards else ""


def game_title(game: str, items: list[dict]) -> str:
    for item in items:
        if item["id"] in (f"{game}-addon", game):
            return item["name"]
    return game.replace("-", " ").title()


def games_live_html(live: list[dict], items: list[dict], ru: bool) -> str:
    if not live:
        return ("<p>Сейчас никто не играет. Начните игру из чата: нажмите на чат правой кнопкой и выберите <b>Play ...</b>.</p>" if ru
                else "<p>Nobody is playing right now. Start a game from a chat: right-click the chat and choose <b>Play ...</b>.</p>")
    head = ("Игра", "Игроков", "Идёт уже", "Ходов", "") if ru else ("Game", "Players", "Playing for", "Moves", "")
    base = "/ru/watch.html" if ru else "/watch.html"
    rows = []
    for n, game in enumerate(sorted(live, key=lambda g: g["created"])):
        minutes = max(0, int((time.time() - float(game["created"])) // 60))
        rows.append(f'<tr{" class=alt" if n % 2 else ""}><td><b>{html.escape(game_title(game["game"], items))}</b></td><td>{len(game["audience"])}</td>'
                    f'<td>{minutes} {"мин" if ru else "min"}</td><td>{game["seq"]}</td>'
                    f'<td><a href="{base}?id={quote(game.get("watch", ""))}"><b>{"Смотреть" if ru else "Watch"}</b></a></td></tr>')
    return '<table class="data"><tr>' + "".join(f"<th>{h}</th>" for h in head) + "</tr>" + "".join(rows) + "</table>"


def scores_html(items: list[dict], ru: bool) -> str:
    from . import main
    out = []
    head = ("Место", "Игрок", "Результат", "Когда") if ru else ("Rank", "Player", "Score", "When")
    with main.database() as db:
        for game in sorted(main.SCORE_GAMES):
            for server in main.NEKOCHAT_SERVERS:
                rows = db.execute(
                    "SELECT s.score, s.updated_at, a.profile, s.nekochat_id FROM game_scores s LEFT JOIN accounts a ON a.server = s.server AND a.nekochat_id = s.nekochat_id "
                    "WHERE s.game = ? AND s.server = ? ORDER BY s.score DESC, s.updated_at ASC LIMIT 20", (game, server)).fetchall()
                title = html.escape(game_title(game, items))
                out.append(f'<h3>{title}</h3>')
                if not rows:
                    out.append("<p>Пока нет результатов. Будьте первым!</p>" if ru else "<p>No scores yet. Be the first!</p>")
                    continue
                body = []
                for rank, row in enumerate(rows, 1):
                    try:
                        profile = json.loads(row["profile"] or "{}")
                    except ValueError:
                        profile = {}
                    name = str(profile.get("display_name") or profile.get("username") or ("Игрок" if ru else "Player"))[:40]
                    when = datetime.datetime.fromtimestamp(row["updated_at"], datetime.timezone.utc).strftime("%Y-%m-%d") if row["updated_at"] else ""
                    medal = {1: "&#129351; ", 2: "&#129352; ", 3: "&#129353; "}.get(rank, "")
                    body.append(f'<tr{" class=alt" if rank % 2 == 0 else ""}><td>{medal}{rank}</td><td><b>{html.escape(name)}</b></td><td align="right">{row["score"]:,}</td><td class="small">{when}</td></tr>')
                out.append('<table class="data"><tr>' + "".join(f"<th>{h}</th>" for h in head) + "</tr>" + "".join(body) + "</table>")
    return "".join(out)


async def tokens(page: str, ru: bool, ua: str = "") -> dict[str, str]:
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
    values["DOWNLOADS"] = downloads_html(release, ru, ua)
    values["HOME_DOWNLOAD"] = home_download(release, ru, ua)
    if page == "index":
        values["GALLERY"] = gallery_html(await catalog_items(), ru)
    if page == "games":
        items = await catalog_items()
        live = [g for g in main._games.values() if not g["closed"]]
        values["GAMES_COUNT"] = str(len(live))
        values["GAMES_LIVE"] = games_live_html(live, items, ru)
        values["SCORES_TABLES"] = scores_html(items, ru)
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


async def dynamic(name: str, ru: bool, query: dict | None = None, ua: str = "") -> Response:
    path = SITE / ("ru" if ru else "") / f"{name}.html"
    if not path.is_file():
        return Response(status_code=404)
    text = path.read_text(encoding="utf-8")
    for key, value in (await tokens(name, ru, ua)).items():
        text = text.replace("{{" + key + "}}", value)
    if name == "catalog":
        items = await catalog_items()
        description = ""
        wanted = next((i for i in items if i["id"] == (query or {}).get("id")), None)
        if wanted and wanted["type"] == "themes":
            description = await catalog_text(f'{CATALOG_RAW}/{quote(wanted["dir"])}/Description.md')
        text = text.replace("{{CATALOG}}", catalog_html(items, query or {}, ru, description))
    return HTMLResponse(text, headers={"Cache-Control": "no-cache", "Vary": "User-Agent"})


@router.get("/", include_in_schema=False)
@router.get("/index.html", include_in_schema=False)
async def home(request: Request) -> Response:
    return await dynamic("index", False, None, request.headers.get("user-agent", ""))


@router.get("/ru", include_in_schema=False)
@router.get("/ru/", include_in_schema=False)
@router.get("/ru/index.html", include_in_schema=False)
async def home_ru(request: Request) -> Response:
    return await dynamic("index", True, None, request.headers.get("user-agent", ""))


@router.get("/download.html", include_in_schema=False)
async def download(request: Request) -> Response:
    return await dynamic("download", False, None, request.headers.get("user-agent", ""))


@router.get("/ru/download.html", include_in_schema=False)
async def download_ru(request: Request) -> Response:
    return await dynamic("download", True, None, request.headers.get("user-agent", ""))


@router.get("/watch-files/{game}", include_in_schema=False)
async def watch_files(game: str) -> Response:
    """Where the spectator page finds the add-on of a game: its folder and files in the catalog."""
    item = next((i for i in await catalog_items() if i["id"] == f"{game}-addon" and i["files"]), None)
    if not item:
        return Response(status_code=404)
    return Response(json.dumps({"raw": CATALOG_RAW, "dir": item["dir"], "files": item["files"]}), media_type="application/json", headers={"Cache-Control": "no-cache"})


@router.get("/catalog.html", include_in_schema=False)
async def catalog(request: Request) -> Response:
    return await dynamic("catalog", False, dict(request.query_params))


@router.get("/ru/catalog.html", include_in_schema=False)
async def catalog_ru(request: Request) -> Response:
    return await dynamic("catalog", True, dict(request.query_params))


@router.get("/games.html", include_in_schema=False)
async def games() -> Response:
    return await dynamic("games", False)


@router.get("/ru/games.html", include_in_schema=False)
async def games_ru() -> Response:
    return await dynamic("games", True)


# pages of an older version of the site
OLD_PAGES = {"/status.html": "/games.html", "/addons.html": "/catalog.html", "/server.html": "/help.html"}
for _old, _new in OLD_PAGES.items():
    for _prefix in ("", "/ru"):
        router.add_api_route(_prefix + _old, (lambda target: (lambda: Response(status_code=308, headers={"Location": target})))(_prefix + _new), methods=["GET"], include_in_schema=False)


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
