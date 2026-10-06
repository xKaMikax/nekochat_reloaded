#!/usr/bin/env python3
"""Builds the website (site/public/*.html and site/public/ru/*.html) from the texts below.
Run from site/: python3 build.py   (the pictures: python3 tools/make_art.py)
Tokens like {{VERSION}} in status.html and download.html are filled by the server (app/site.py) when the page is served."""
import datetime
import os
import time
BUILD = int(time.time())   # the style sheet gets this in its address, so a phone never keeps an old one

REPO = "https://github.com/xKaMikax/nekochat_reloaded"
THEMES = "https://github.com/xKaMikax/nekochat_reloaded_themes"
OFFICIAL = "https://github.com/komdu/nekochat"
WEB = "/app/"   # the web version of the client, served by this server
ORDER = ["index", "features", "download", "addons", "catalog", "server", "status", "about"]

T = {
    "en": {
        "lang": "en", "other": "ru", "other_name": "Русский", "dir": "",
        "nav": {"index": "Home", "features": "Features", "download": "Download", "addons": "Add-ons &amp; Themes", "catalog": "Catalog",
                "server": "The Server", "status": "Server Status", "about": "About"},
        "menu": "Menu", "language": "Language", "links": "Links",
        "guestbook": "Guestbook", "code": "Source code", "webclient": "Web version",
        "titles": {"index": "Welcome!", "features": "Features", "download": "Download", "addons": "Add-ons and Themes", "catalog": "Catalog",
                   "server": "The Nekochat Reloaded Server", "status": "Server Status", "about": "About this site"},
        "visitor": "You are visitor number", "updated": "Last updated", "best": "This page is best viewed with Internet Explorer 6.0 at 1024 x 768, 16-bit colour or better. (Any other browser will do too.)",
        "disclaimer": "Nekochat Reloaded is a fan project. It is not made by or connected with Microsoft. Windows and Windows XP are trademarks of Microsoft Corporation.",
        "pages": {},
    },
    "ru": {
        "lang": "ru", "other": "en", "other_name": "English", "dir": "ru/",
        "nav": {"index": "Главная", "features": "Возможности", "download": "Скачать", "addons": "Дополнения и темы", "catalog": "Каталог",
                "server": "Сервер", "status": "Состояние сервера", "about": "О сайте"},
        "menu": "Меню", "language": "Язык", "links": "Ссылки",
        "guestbook": "Гостевая книга", "code": "Исходный код", "webclient": "Веб-версия",
        "titles": {"index": "Добро пожаловать!", "features": "Возможности", "download": "Скачать", "addons": "Дополнения и темы", "catalog": "Каталог",
                   "server": "Сервер Nekochat Reloaded", "status": "Состояние сервера", "about": "О сайте"},
        "visitor": "Вы посетитель номер", "updated": "Обновлено", "best": "Сайт лучше всего смотреть в Internet Explorer 6.0 при разрешении 1024 x 768 и цвете не менее 16 бит. (Подойдёт и любой другой браузер.)",
        "disclaimer": "Nekochat Reloaded — любительский проект. Он не создан Microsoft и не связан с ней. Windows и Windows XP — товарные знаки Microsoft Corporation.",
        "pages": {},
    },
}

# ---------------------------------------------------------------------------------------------------------- English
T["en"]["pages"]["index"] = f"""
<table class="cols head" width="100%" cellspacing="0" cellpadding="0"><tr><td><h1>Welcome to Nekochat Reloaded!</h1></td><td align="right" valign="top"><img src="/img/new.gif" width="42" height="16" alt="NEW!"></td></tr></table>
<div class="news"><marquee behavior="scroll" direction="left" scrollamount="3">*** {{{{LATEST_LINE}}}} *** Games from Windows XP: Solitaire, Hearts, Reversi, 3D Pinball with shared high scores *** Send files in chats, up to 50 MB kept for good *** Nekochat Reloaded Update: themes, sounds, assistants and add-ons *** </marquee></div>
<p>&nbsp;</p>
<table class="cols" width="100%" cellspacing="0" cellpadding="0"><tr>
<td valign="top">
<p><b>Nekochat Reloaded</b> is a chat program that looks and sounds like <b>Windows XP</b>. It is a custom client for the
<a href="{OFFICIAL}">Nekochat</a> server: you sign in with your Nekochat account and talk in rooms and direct messages, call your friends,
share your screen, send files and play the old games of Windows XP together.</p>
<p>It runs on <b>Windows, Linux, Android, iPhone</b> and in a <b>web browser</b>, so your chats and your settings follow you.</p>
<p><img src="/img/bullet-red.gif" width="11" height="11" alt="*"> <a href="download.html"><b>Download it now!</b></a> It is free.</p>
<p><img src="/img/bullet-red.gif" width="11" height="11" alt="*"> Or <a href="{WEB}"><b>try the web version</b></a> right here, nothing to install.</p>
</td>
<td width="14">&nbsp;</td>
<td valign="top" width="410"><img class="shot" src="/img/screenshot.png" width="400" alt="The Nekochat Reloaded window"><br><span class="small">The PC client with the Windows XP (Luna) theme.</span></td>
</tr></table>
<h2>What can it do?</h2>
<ul class="arrows">
<li>Rooms and direct messages, reactions, pinned messages, typing and read marks, chats in their own windows.</li>
<li>Voice calls, screen sharing and notifications.</li>
<li>Windows XP themes (Luna, Classic and more), the XP sounds, a Control Panel and Help and Support.</li>
<li>Solitaire, Spider Solitaire, FreeCell, Hearts, Spades, Reversi, Checkers, Backgammon, Minesweeper and 3D Pinball.</li>
<li>Files in chats and <b>Infinity Memory</b>: files kept on the server for friends who were offline.</li>
</ul>
<p><a href="features.html">Read more about the features &raquo;</a></p>
<div class="box"><div class="title">Please note</div><div class="body">Nekochat Reloaded is an <b>unofficial</b> client. The official Nekochat client is here: <a href="{OFFICIAL}">{OFFICIAL}</a>.</div></div>
"""

T["en"]["pages"]["features"] = f"""
<h1>Features</h1>
<h2>Chats</h2>
<ul class="arrows">
<li>Rooms and direct messages on your Nekochat server, reactions, pinned messages, typing marks and read marks.</li>
<li>Detached chat windows: open a chat in a window of its own, like old messengers did.</li>
<li>Voice calls and screen sharing; notifications with the XP sounds.</li>
<li><b>Files:</b> click the paperclip, drag a file into the window or paste it. <b>Infinity Memory</b> keeps a file (up to 50 MB) on the Nekochat Reloaded server, so a friend who was offline can still get it by a link.</li>
<li>Statuses: online, away, do not disturb and invisible.</li>
</ul>
<h2>The Windows XP look</h2>
<ul class="arrows">
<li>Windows with Luna title bars and buttons, the Classic theme, and colour schemes; every window uses the theme.</li>
<li>Original XP sounds for notifications, login and calls; cursors and icons you can change.</li>
<li>A Control Panel, Help and Support, and the assistants <b>Rover, Merlin, Courtney and Earl</b> (installed from Nekochat Reloaded Update when you want them).</li>
</ul>
<h2>Games from Windows XP</h2>
<ul class="arrows">
<li>Solitaire, Spider Solitaire, FreeCell, Hearts, Spades, Reversi, Checkers and Backgammon with the original cards, boards, dice and sounds. Play against the computer or against friends.</li>
<li><b>3D Pinball: Space Cadet</b> with <b>High Scores shared</b> by everyone on your Nekochat server.</li>
<li>Challenges: send a Solitaire, Spider, FreeCell or Minesweeper deal to a chat, everyone gets the same game and the results come back to the chat.</li>
<li>Minesweeper, also on phones (hold a square to put a flag).</li>
</ul>
<h2>Everywhere</h2>
<table class="data"><tr><th>Platform</th><th>How</th></tr>
<tr><td>Windows</td><td>Installer (Windows XP style setup) or portable exe</td></tr>
<tr class="alt"><td>Linux</td><td>AppImage or .deb package</td></tr>
<tr><td>Android</td><td>.apk, Android 8.0 or later</td></tr>
<tr class="alt"><td>iPhone / iPad</td><td>.ipa installed with AltStore, iOS 16.4 or later</td></tr>
<tr><td>Web browser</td><td><a href="{WEB}">Open the web version</a>, nothing to install</td></tr></table>
"""

T["en"]["pages"]["download"] = f"""
<h1>Download</h1>
<div class="box"><div class="title">Latest release</div><div class="body">{{{{LATEST_BOX}}}}</div></div>
<p>All files are on the release page on GitHub: <a href="{REPO}/releases/latest">{REPO}/releases/latest</a>.</p>
<table class="data"><tr><th>Platform</th><th>File</th><th>Notes</th></tr>
<tr><td>Windows</td><td>Nekochat-Reloaded-Setup-<i>version</i>.exe</td><td>Installer. The portable version is <i>Nekochat-Reloaded-<i>version</i>-portable.exe</i>.</td></tr>
<tr class="alt"><td>Linux</td><td>Nekochat-Reloaded-<i>version</i>.AppImage<br>nekochat-reloaded_<i>version</i>_amd64.deb</td><td>AppImage: make it executable and run it.</td></tr>
<tr><td>Android</td><td>Nekochat-Reloaded-<i>version</i>.apk</td><td>Android 8.0 or later; installs over earlier versions.</td></tr>
<tr class="alt"><td>iPhone / iPad</td><td>Nekochat-Reloaded-<i>version</i>.ipa</td><td>iOS 16.4 or later. It is not signed: install it with <a href="https://altstore.io">AltStore</a>.</td></tr>
<tr><td>Web</td><td><a href="{WEB}">Open the web version</a></td><td>The same client in your browser, nothing to install. Works on a phone too.</td></tr></table>
<h2>First start</h2>
<ol>
<li>Install and start the client.</li>
<li>Sign in with your <b>Nekochat</b> account (the client uses the Nekochat server for chats and calls).</li>
<li>Open <b>Windows Update</b> in the Control Panel to add themes, games and assistants.</li>
</ol>
<p class="small">Beta versions are published on the <a href="{REPO}/releases">releases page</a> too, marked as pre-release.</p>
"""

T["en"]["pages"]["addons"] = f"""
<h1>Add-ons and Themes</h1>
<p><b>Nekochat Reloaded Update</b> is built into the client and looks like Windows Update. It installs things you choose, and keeps the app itself up to date.</p>
<table class="data"><tr><th>Kind</th><th>What you get</th></tr>
<tr><td>Themes</td><td>Windows look-alikes for the whole client: Luna, Classic and more.</td></tr>
<tr class="alt"><td>Sounds, cursors, icons</td><td>Sound schemes, cursor sets and icon packs.</td></tr>
<tr><td>Wallpapers</td><td>Pictures for the desktop of the client.</td></tr>
<tr class="alt"><td>Assistants</td><td>Rover, Merlin, Courtney and Earl, the helpers of Windows XP.</td></tr>
<tr><td>Add-ons</td><td>Minesweeper, the Theme Editor, the Admin Panel and the games. Each has its own Help and About box.</td></tr></table>
<p>Packs live in a public repository: <a href="{THEMES}">{THEMES}</a>.</p>
"""

T["en"]["pages"]["catalog"] = f"""
<h1>Catalog</h1>
<p>Everything in <b>Nekochat Reloaded Update</b>, live from the public catalog: themes, cursors, sounds, wallpapers, assistants, add-ons and combos. To install something, open <b>Windows Update</b> in the Control Panel of the client (<a href="{WEB}">the web version</a> has it too).</p>
{{{{CATALOG}}}}
<p class="small">The catalog lives in <a href="{THEMES}">{THEMES}</a>; this list is refreshed every ten minutes.</p>
"""

T["en"]["pages"]["server"] = f"""
<h1>The Nekochat Reloaded Server</h1>
<p>The clients talk to two servers: your <b>Nekochat</b> server (chats and calls) and the <b>Nekochat Reloaded</b> server, a small companion that this site runs on.
It does <b>not</b> replace or proxy the Nekochat server; it adds what Nekochat does not have.</p>
<table class="data"><tr><th>Feature</th><th>What it does</th></tr>
<tr><td>Settings and read state</td><td>Your settings and what you have read follow you from one device to another.</td></tr>
<tr class="alt"><td>Statuses and presence</td><td>Online, away, do not disturb, invisible; reactions, pins, typing marks.</td></tr>
<tr><td>Games</td><td>Relays the moves of the XP games between players.</td></tr>
<tr class="alt"><td>High scores</td><td>One best score per user for 3D Pinball.</td></tr>
<tr><td>Infinity Memory</td><td>Files up to 50 MB kept for good, shared by a link nobody can guess.</td></tr>
<tr class="alt"><td>Backups</td><td>Settings backups made by the client.</td></tr></table>
<p>Your Nekochat token is checked once and never stored. See the live <a href="/api/docs">API documentation</a> and the <a href="status.html">server status</a>.</p>
"""

T["en"]["pages"]["status"] = f"""
<h1>Server Status</h1>
<p><span class="red">&#9679;</span> <b>{{{{STATE}}}}</b></p>
<table class="data"><tr><th>Item</th><th>Value</th></tr>
<tr><td>Server version</td><td>{{{{VERSION}}}}</td></tr>
<tr class="alt"><td>Up for</td><td>{{{{UPTIME}}}}</td></tr>
<tr><td>Nekochat servers accepted</td><td>{{{{SERVERS}}}}</td></tr>
<tr class="alt"><td>Linked accounts</td><td>{{{{ACCOUNTS}}}}</td></tr>
<tr><td>Games being played now</td><td>{{{{GAMES}}}}</td></tr>
<tr class="alt"><td>High scores kept</td><td>{{{{SCORES}}}}</td></tr>
<tr><td>Files in Infinity Memory</td><td>{{{{FILES}}}} ({{{{FILES_MB}}}} MB)</td></tr>
<tr class="alt"><td>Server time</td><td>{{{{NOW}}}}</td></tr></table>
<p class="small">The page is made by the server each time you open it.</p>
"""

T["en"]["pages"]["about"] = f"""
<h1>About this site</h1>
<p>This is the home page of <b>Nekochat Reloaded</b>, made the way home pages were made around 2002: tables, bevelled buttons, a visitor counter and a marquee. It is served by the Nekochat Reloaded server itself.</p>
<h2>Who makes it</h2>
<p>Nekochat Reloaded is made by <b>KaMika</b> (<a href="https://github.com/xKaMikax">xKaMikax</a>) and the Nekochat Reloaded Team. The iPhone client is made together with VASHYAN-CMD.</p>
<h2>Links</h2>
<ul class="arrows">
<li><a href="{REPO}">The client on GitHub</a> (PC, Android, iPhone and web branches)</li>
<li><a href="{REPO}/issues">Guestbook</a>: write a note or report a problem (GitHub Issues)</li>
<li><a href="{THEMES}">Themes and add-ons</a></li>
<li><a href="{OFFICIAL}">Nekochat</a>, the official client and server this one works with</li>
</ul>
<h2>Please note</h2>
<p>Nekochat Reloaded is a fan project. It is not made by or connected with Microsoft. Windows and Windows XP are trademarks of Microsoft Corporation.</p>
"""

# ---------------------------------------------------------------------------------------------------------- Russian
T["ru"]["pages"]["index"] = f"""
<table class="cols head" width="100%" cellspacing="0" cellpadding="0"><tr><td><h1>Добро пожаловать в Nekochat Reloaded!</h1></td><td align="right" valign="top"><img src="/img/new.gif" width="42" height="16" alt="NEW!"></td></tr></table>
<div class="news"><marquee behavior="scroll" direction="left" scrollamount="3">*** {{{{LATEST_LINE}}}} *** Игры из Windows XP: Косынка, Червы, Реверси, 3D Pinball с общими рекордами *** Файлы в чатах, до 50 МБ хранятся навсегда *** Nekochat Reloaded Update: темы, звуки, помощники и дополнения *** </marquee></div>
<p>&nbsp;</p>
<table class="cols" width="100%" cellspacing="0" cellpadding="0"><tr>
<td valign="top">
<p><b>Nekochat Reloaded</b> — программа для общения, которая выглядит и звучит как <b>Windows XP</b>. Это свой клиент для сервера
<a href="{OFFICIAL}">Nekochat</a>: вы входите со своей учётной записью Nekochat, общаетесь в комнатах и личных сообщениях, звоните друзьям,
показываете экран, отправляете файлы и вместе играете в старые игры Windows XP.</p>
<p>Работает на <b>Windows, Linux, Android, iPhone</b> и <b>в браузере</b>, так что чаты и настройки всегда с вами.</p>
<p><img src="/img/bullet-red.gif" width="11" height="11" alt="*"> <a href="download.html"><b>Скачать прямо сейчас!</b></a> Это бесплатно.</p>
<p><img src="/img/bullet-red.gif" width="11" height="11" alt="*"> Или <a href="{WEB}"><b>попробуйте веб-версию</b></a> прямо здесь, ничего ставить не нужно.</p>
</td>
<td width="14">&nbsp;</td>
<td valign="top" width="410"><img class="shot" src="/img/screenshot.png" width="400" alt="Окно Nekochat Reloaded"><br><span class="small">Клиент для ПК с темой Windows XP (Luna).</span></td>
</tr></table>
<h2>Что он умеет?</h2>
<ul class="arrows">
<li>Комнаты и личные сообщения, реакции, закреплённые сообщения, «печатает…» и отметки прочтения, чаты в отдельных окнах.</li>
<li>Голосовые звонки, показ экрана и уведомления.</li>
<li>Темы Windows XP (Luna, Classic и другие), звуки XP, Панель управления и Центр справки и поддержки.</li>
<li>Косынка, Паук, FreeCell, Червы, Пики, Реверси, Шашки, Нарды, Сапёр и 3D Pinball.</li>
<li>Файлы в чатах и <b>Infinity Memory</b>: файлы хранятся на сервере для друзей, которые были не в сети.</li>
</ul>
<p><a href="features.html">Подробнее о возможностях &raquo;</a></p>
<div class="box"><div class="title">Обратите внимание</div><div class="body">Nekochat Reloaded — <b>неофициальный</b> клиент. Официальный клиент Nekochat: <a href="{OFFICIAL}">{OFFICIAL}</a>.</div></div>
"""

T["ru"]["pages"]["features"] = f"""
<h1>Возможности</h1>
<h2>Чаты</h2>
<ul class="arrows">
<li>Комнаты и личные сообщения на вашем сервере Nekochat, реакции, закреплённые сообщения, отметки «печатает» и «прочитано».</li>
<li>Чаты в отдельных окнах, как в старых мессенджерах.</li>
<li>Голосовые звонки и показ экрана; уведомления со звуками XP.</li>
<li><b>Файлы:</b> нажмите скрепку, перетащите файл в окно или вставьте его. <b>Infinity Memory</b> хранит файл (до 50 МБ) на сервере Nekochat Reloaded, и друг, который был не в сети, скачает его по ссылке.</li>
<li>Статусы: в сети, отошёл, не беспокоить и невидимка.</li>
</ul>
<h2>Внешний вид Windows XP</h2>
<ul class="arrows">
<li>Окна с заголовками и кнопками Luna, тема Classic и цветовые схемы; тему используют все окна.</li>
<li>Оригинальные звуки XP для уведомлений, входа и звонков; курсоры и значки можно менять.</li>
<li>Панель управления, Центр справки и поддержки и помощники <b>Rover, Merlin, Courtney и Earl</b> (ставятся из Nekochat Reloaded Update, когда захотите).</li>
</ul>
<h2>Игры из Windows XP</h2>
<ul class="arrows">
<li>Косынка, Паук, FreeCell, Червы, Пики, Реверси, Шашки и Нарды с оригинальными картами, досками, костями и звуками. Играйте с компьютером или с друзьями.</li>
<li><b>3D Pinball: Space Cadet</b> с <b>общими рекордами</b> всех пользователей вашего сервера Nekochat.</li>
<li>Вызовы: отправьте в чат расклад Косынки, Паука, FreeCell или Сапёра — у всех одна и та же игра, результаты приходят в чат.</li>
<li>Сапёр и на телефонах (удерживайте клетку, чтобы поставить флажок).</li>
</ul>
<h2>Везде</h2>
<table class="data"><tr><th>Платформа</th><th>Как</th></tr>
<tr><td>Windows</td><td>Установщик (в стиле установки Windows XP) или портативный exe</td></tr>
<tr class="alt"><td>Linux</td><td>AppImage или пакет .deb</td></tr>
<tr><td>Android</td><td>.apk, Android 8.0 и новее</td></tr>
<tr class="alt"><td>iPhone / iPad</td><td>.ipa, ставится через AltStore, iOS 16.4 и новее</td></tr>
<tr><td>Браузер</td><td><a href="{WEB}">Открыть веб-версию</a>, ничего устанавливать не нужно</td></tr></table>
"""

T["ru"]["pages"]["download"] = f"""
<h1>Скачать</h1>
<div class="box"><div class="title">Последний выпуск</div><div class="body">{{{{LATEST_BOX}}}}</div></div>
<p>Все файлы лежат на странице выпуска на GitHub: <a href="{REPO}/releases/latest">{REPO}/releases/latest</a>.</p>
<table class="data"><tr><th>Платформа</th><th>Файл</th><th>Примечания</th></tr>
<tr><td>Windows</td><td>Nekochat-Reloaded-Setup-<i>версия</i>.exe</td><td>Установщик. Портативная версия: <i>Nekochat-Reloaded-<i>версия</i>-portable.exe</i>.</td></tr>
<tr class="alt"><td>Linux</td><td>Nekochat-Reloaded-<i>версия</i>.AppImage<br>nekochat-reloaded_<i>версия</i>_amd64.deb</td><td>AppImage: сделайте файл исполняемым и запустите.</td></tr>
<tr><td>Android</td><td>Nekochat-Reloaded-<i>версия</i>.apk</td><td>Android 8.0 и новее; ставится поверх прежних версий.</td></tr>
<tr class="alt"><td>iPhone / iPad</td><td>Nekochat-Reloaded-<i>версия</i>.ipa</td><td>iOS 16.4 и новее. Файл не подписан: ставьте через <a href="https://altstore.io">AltStore</a>.</td></tr>
<tr><td>Браузер</td><td><a href="{WEB}">Открыть веб-версию</a></td><td>Тот же клиент в браузере, ничего ставить не нужно. Работает и на телефоне.</td></tr></table>
<h2>Первый запуск</h2>
<ol>
<li>Установите и запустите клиент.</li>
<li>Войдите со своей учётной записью <b>Nekochat</b> (чаты и звонки идут через сервер Nekochat).</li>
<li>Откройте <b>Windows Update</b> в Панели управления, чтобы добавить темы, игры и помощников.</li>
</ol>
<p class="small">Бета-версии тоже публикуются на <a href="{REPO}/releases">странице выпусков</a> с пометкой «pre-release».</p>
"""

T["ru"]["pages"]["addons"] = f"""
<h1>Дополнения и темы</h1>
<p><b>Nekochat Reloaded Update</b> встроен в клиент и похож на Windows Update. Он ставит то, что вы выберете, и обновляет само приложение.</p>
<table class="data"><tr><th>Вид</th><th>Что вы получите</th></tr>
<tr><td>Темы</td><td>Оформление в стиле Windows для всего клиента: Luna, Classic и другие.</td></tr>
<tr class="alt"><td>Звуки, курсоры, значки</td><td>Схемы звуков, наборы курсоров и значков.</td></tr>
<tr><td>Обои</td><td>Картинки для рабочего стола клиента.</td></tr>
<tr class="alt"><td>Помощники</td><td>Rover, Merlin, Courtney и Earl — помощники Windows XP.</td></tr>
<tr><td>Дополнения</td><td>Сапёр, Редактор тем, Панель администратора и игры. У каждого своя справка и окно «О программе».</td></tr></table>
<p>Пакеты лежат в открытом репозитории: <a href="{THEMES}">{THEMES}</a>.</p>
"""

T["ru"]["pages"]["catalog"] = f"""
<h1>Каталог</h1>
<p>Всё, что есть в <b>Nekochat Reloaded Update</b>, прямо из открытого каталога: темы, курсоры, звуки, обои, помощники, дополнения и наборы. Чтобы что-то установить, откройте <b>Windows Update</b> в Панели управления клиента (в <a href="{WEB}">веб-версии</a> он тоже есть).</p>
{{{{CATALOG}}}}
<p class="small">Каталог лежит в <a href="{THEMES}">{THEMES}</a>; список обновляется каждые десять минут.</p>
"""

T["ru"]["pages"]["server"] = f"""
<h1>Сервер Nekochat Reloaded</h1>
<p>Клиенты общаются с двумя серверами: вашим сервером <b>Nekochat</b> (чаты и звонки) и сервером <b>Nekochat Reloaded</b> — небольшим помощником, на котором работает этот сайт.
Он <b>не</b> заменяет сервер Nekochat и не проксирует его; он добавляет то, чего в Nekochat нет.</p>
<table class="data"><tr><th>Возможность</th><th>Что делает</th></tr>
<tr><td>Настройки и отметки прочтения</td><td>Настройки и прочитанное переходят с одного устройства на другое.</td></tr>
<tr class="alt"><td>Статусы и присутствие</td><td>В сети, отошёл, не беспокоить, невидимка; реакции, закрепления, «печатает».</td></tr>
<tr><td>Игры</td><td>Передаёт ходы игр XP между игроками.</td></tr>
<tr class="alt"><td>Рекорды</td><td>Один лучший результат на пользователя в 3D Pinball.</td></tr>
<tr><td>Infinity Memory</td><td>Файлы до 50 МБ хранятся навсегда, доступ по ссылке, которую нельзя угадать.</td></tr>
<tr class="alt"><td>Резервные копии</td><td>Копии настроек, которые делает клиент.</td></tr></table>
<p>Токен Nekochat проверяется один раз и не сохраняется. Смотрите живую <a href="/api/docs">документацию API</a> и <a href="status.html">состояние сервера</a>.</p>
"""

T["ru"]["pages"]["status"] = f"""
<h1>Состояние сервера</h1>
<p><span class="red">&#9679;</span> <b>{{{{STATE}}}}</b></p>
<table class="data"><tr><th>Параметр</th><th>Значение</th></tr>
<tr><td>Версия сервера</td><td>{{{{VERSION}}}}</td></tr>
<tr class="alt"><td>Работает</td><td>{{{{UPTIME}}}}</td></tr>
<tr><td>Принимаемые серверы Nekochat</td><td>{{{{SERVERS}}}}</td></tr>
<tr class="alt"><td>Привязанных учётных записей</td><td>{{{{ACCOUNTS}}}}</td></tr>
<tr><td>Игр идёт сейчас</td><td>{{{{GAMES}}}}</td></tr>
<tr class="alt"><td>Хранится рекордов</td><td>{{{{SCORES}}}}</td></tr>
<tr><td>Файлов в Infinity Memory</td><td>{{{{FILES}}}} ({{{{FILES_MB}}}} МБ)</td></tr>
<tr class="alt"><td>Время сервера</td><td>{{{{NOW}}}}</td></tr></table>
<p class="small">Страницу сервер создаёт заново при каждом открытии.</p>
"""

T["ru"]["pages"]["about"] = f"""
<h1>О сайте</h1>
<p>Это домашняя страница <b>Nekochat Reloaded</b>, сделанная так, как делали домашние страницы около 2002 года: таблицы, объёмные кнопки, счётчик посетителей и бегущая строка. Её отдаёт сам сервер Nekochat Reloaded.</p>
<h2>Кто делает</h2>
<p>Nekochat Reloaded делает <b>KaMika</b> (<a href="https://github.com/xKaMikax">xKaMikax</a>) и команда Nekochat Reloaded. Клиент для iPhone делается вместе с VASHYAN-CMD.</p>
<h2>Ссылки</h2>
<ul class="arrows">
<li><a href="{REPO}">Клиент на GitHub</a> (ветки для ПК, Android, iPhone и веба)</li>
<li><a href="{REPO}/issues">Гостевая книга</a>: оставьте записку или сообщите о проблеме (GitHub Issues)</li>
<li><a href="{THEMES}">Темы и дополнения</a></li>
<li><a href="{OFFICIAL}">Nekochat</a> — официальный клиент и сервер, с которым это работает</li>
</ul>
<h2>Обратите внимание</h2>
<p>Nekochat Reloaded — любительский проект. Он не создан Microsoft и не связан с ней. Windows и Windows XP — товарные знаки Microsoft Corporation.</p>
"""


def page(lang, name):
    t = T[lang]
    here = t["dir"]
    nav = "".join(
        f'<a href="/{here}{p}.html"{" class=\"here\"" if p == name else ""}>{t["nav"][p]}</a>' if p != "index" else
        f'<a href="/{here}"{" class=\"here\"" if p == name else ""}>{t["nav"][p]}</a>'
        for p in ORDER)
    other_url = ("/" if lang == "ru" else "/ru/") + ("" if name == "index" else f"{name}.html")
    now = datetime.date.today().strftime("%d %B %Y") if lang == "en" else datetime.date.today().strftime("%d.%m.%Y")
    return f"""<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html lang="{t['lang']}">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nekochat Reloaded - {t['titles'][name]}</title>
<meta name="description" content="Nekochat Reloaded - the Windows XP style client for Nekochat">
<link rel="stylesheet" href="/style.css?v={BUILD}" type="text/css">
<link rel="shortcut icon" href="/favicon.ico">
</head>
<body background="/img/bg.gif" bgcolor="#e2eaf7">
<table class="outer" width="760" align="center" cellspacing="0" cellpadding="0" border="0">
<tr><td colspan="2"><a href="/{here}"><img class="banner" src="/img/banner.png" width="760" height="100" alt="Nekochat Reloaded"></a></td></tr>
<tr>
<td class="nav" width="160" valign="top">
<div class="head">{t['menu']}</div>
{nav}
<div class="head">{t['language']}</div>
<a href="{other_url}">{t['other_name']}</a>
<div class="head">{t['links']}</div>
<a href="{REPO}">{t['code']}</a>
<a href="{REPO}/issues">{t['guestbook']}</a>
<a href="{WEB}">{t["webclient"]}</a>
<p align="center"><img src="/img/construction.gif" width="130" height="26" alt="Under construction"></p>
</td>
<td class="main" valign="top">
{t['pages'][name]}
<p align="center"><img src="/img/rainbow.gif" width="520" height="4" alt=""></p>
<p align="center" class="small">{t['best']}</p>
</td>
</tr>
<tr><td colspan="2" class="foot">
<p>{t['visitor']} <img class="counter" src="/counter.svg" width="96" height="22" alt="visitor counter"></p>
<p><img src="/img/btn-notepad.gif" width="88" height="31" alt="Made with Notepad"> <img src="/img/btn-ie6.gif" width="88" height="31" alt="Best viewed in Internet Explorer 6"> <img src="/img/btn-html.gif" width="88" height="31" alt="Valid HTML 4.01"> <img src="/img/btn-python.gif" width="88" height="31" alt="Powered by Python"> <img src="/img/btn-res.gif" width="88" height="31" alt="1024 x 768"> <img src="/img/btn-nekochat.gif" width="88" height="31" alt="Nekochat Reloaded"></p>
<p>{t['disclaimer']}</p>
<p>&copy; 2026 Nekochat Reloaded Team. {t['updated']}: {now}.</p>
</td></tr>
</table>
</body>
</html>
"""


root = os.path.dirname(os.path.abspath(__file__))
for lang in ("en", "ru"):
    out = os.path.join(root, "public", T[lang]["dir"])
    os.makedirs(out, exist_ok=True)
    for name in ORDER:
        with open(os.path.join(out, f"{name}.html"), "w", encoding="utf-8") as f:
            f.write(page(lang, name))
print("pages written")
