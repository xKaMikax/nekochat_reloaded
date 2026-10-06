#!/usr/bin/env python3
"""Builds the website (site/public/*.html and site/public/ru/*.html) from the texts below.
Run from site/: python3 build.py   (the pictures: python3 tools/make_art.py)
Tokens like {{DOWNLOADS}} are filled by the server (app/site.py) when a page is served."""
import datetime
import os
import time

BUILD = int(time.time())   # the style sheet gets this in its address, so a phone never keeps an old one
REPO = "https://github.com/xKaMikax/nekochat_reloaded"
OFFICIAL = "https://github.com/komdu/nekochat"
NEKOCHAT_SERVER = "https://nekochat.komdu.is-cool.dev"
WEB = "/app/"   # the web version of the client, served by this server
ORDER = ["index", "features", "download", "catalog", "games", "help", "about"]
EXTRA = ["watch"]   # pages that are not in the menu

T = {
    "en": {
        "lang": "en", "other": "ru", "other_name": "Русский", "dir": "",
        "nav": {"index": "Home", "features": "What it can do", "download": "Download", "catalog": "Themes &amp; Games", "games": "Games &amp; Scores",
                "help": "Help", "about": "About"},
        "titles": {"index": "Chat like it is 2001", "features": "What it can do", "download": "Download", "catalog": "Themes and Games", "games": "Games and Scores",
                   "help": "Help", "about": "About", "watch": "Watching a game"},
        "menu": "Menu", "language": "Language", "search": "Find a theme or game", "go": "Go", "webclient": "Try it online",
        "visitor": "You are visitor number", "updated": "Last updated",
        "best": "This page is best viewed with Internet Explorer 6.0 at 1024 x 768. (Any other browser will do too.)",
        "disclaimer": "Nekochat Reloaded is made by fans. It is not made by or connected with Microsoft. Windows and Windows XP are trademarks of Microsoft Corporation.",
        "pages": {},
    },
    "ru": {
        "lang": "ru", "other": "en", "other_name": "English", "dir": "ru/",
        "nav": {"index": "Главная", "features": "Что умеет", "download": "Скачать", "catalog": "Темы и игры", "games": "Игры и рекорды",
                "help": "Помощь", "about": "О проекте"},
        "titles": {"index": "Общайтесь, как в 2001-м", "features": "Что умеет", "download": "Скачать", "catalog": "Темы и игры", "games": "Игры и рекорды",
                   "help": "Помощь", "about": "О проекте", "watch": "Просмотр игры"},
        "menu": "Меню", "language": "Язык", "search": "Найти тему или игру", "go": "Найти", "webclient": "Попробовать онлайн",
        "visitor": "Вы посетитель номер", "updated": "Обновлено",
        "best": "Сайт лучше всего смотреть в Internet Explorer 6.0 при разрешении 1024 x 768. (Подойдёт и любой другой браузер.)",
        "disclaimer": "Nekochat Reloaded сделан поклонниками. Он не создан Microsoft и не связан с ней. Windows и Windows XP — товарные знаки Microsoft Corporation.",
        "pages": {},
    },
}

# ----------------------------------------------------------------------------------------------------------- English
T["en"]["pages"]["index"] = f"""
<table class="head" width="100%" cellspacing="0" cellpadding="0"><tr><td><h1>Welcome to Nekochat Reloaded!</h1></td><td align="right" valign="top"><img src="/img/new.gif" width="42" height="16" alt="NEW!"></td></tr></table>
<div class="news"><marquee behavior="scroll" direction="left" scrollamount="3">*** {{{{LATEST_LINE}}}} *** Play Solitaire, Hearts, Reversi and 3D Pinball with your friends *** Send files in chats, up to 50 MB *** New themes, sounds and helpers in the built-in Windows Update *** </marquee></div>
<p>&nbsp;</p>
<table class="tiles" cellspacing="0" cellpadding="0"><tr>
<td><a class="tile" href="download.html">Download<span>Windows, Linux, Android, iPhone</span></a></td>
<td><a class="tile" href="{WEB}">Try it online<span>open it right here, nothing to install</span></a></td>
<td><a class="tile" href="catalog.html">Themes &amp; Games<span>look around before you install</span></a></td>
<td><a class="tile" href="games.html">Games &amp; Scores<span>who is playing, the best scores</span></a></td>
</tr></table>
<p>&nbsp;</p>
<table class="hero" cellspacing="0" cellpadding="0"><tr>
<td valign="top">
<p><b>Nekochat Reloaded</b> is a chat program that looks and sounds just like <b>Windows XP</b>. Talk with your friends, make voice calls, share your screen, send files, and play the old Windows games together: Solitaire, Hearts, Reversi, Pinball and more.</p>
<p>It works on <b>Windows, Linux, Android and iPhone</b>, and in your <b>web browser</b>.</p>
<p><img src="/img/bullet-red.gif" width="11" height="11" alt="*"> {{{{HOME_DOWNLOAD}}}}</p>
<p><img src="/img/bullet-red.gif" width="11" height="11" alt="*"> Or <a href="{WEB}"><b>try it online</b></a> right now, nothing to install.</p>
<h2>Get started in three steps</h2>
<ol>
<li><b>Download</b> the program for your device, or open the online version.</li>
<li><b>Sign in</b> with your Nekochat account. No account yet? Make one on <a href="{NEKOCHAT_SERVER}">the Nekochat server</a>.</li>
<li><b>Make it yours:</b> open <i>Windows Update</i> in the Control Panel to add themes, sounds, games and helpers.</li>
</ol>
</td>
<td width="14">&nbsp;</td>
<td valign="top" width="590"><img class="shot" src="/img/screenshot.png" width="560" alt="The Nekochat Reloaded window"><br><span class="small">Nekochat Reloaded with the Windows XP theme.</span></td>
</tr></table>
<h2>See it in action</h2>
{{{{GALLERY}}}}
<p><a href="catalog.html">See all themes and games &raquo;</a></p>
"""

T["en"]["pages"]["features"] = f"""
<h1>What it can do</h1>
<h2>Chat with friends</h2>
<ul class="arrows">
<li>Group chats (rooms) and private messages, with reactions, pinned messages, and marks that show who is typing and who has read.</li>
<li>Open any chat in a window of its own, like the messengers of old.</li>
<li>Voice calls and screen sharing.</li>
<li>Your status: online, away, do not disturb, or invisible.</li>
</ul>
<h2>Send files</h2>
<ul class="arrows">
<li>Click the paperclip, drag a file into the window, or paste it.</li>
<li>Tick <b>Infinity Memory</b> to keep a file (up to 50 MB) available by a link, so a friend who was away can still get it.</li>
</ul>
<h2>Looks and sounds like Windows XP</h2>
<ul class="arrows">
<li>The classic blue Luna look, the grey Classic look, and more themes to choose from. Every window follows the theme.</li>
<li>The famous Windows XP sounds, and cursors and icons you can change.</li>
<li>A Control Panel, Help and Support, and the little helpers <b>Rover, Merlin, Courtney and Earl</b>.</li>
</ul>
<h2>Play together</h2>
<ul class="arrows">
<li>Solitaire, Spider Solitaire, FreeCell, Hearts, Spades, Reversi, Checkers, Backgammon, Minesweeper and 3D Pinball, with the original cards, boards and sounds.</li>
<li>Play against the computer, or invite a friend from a chat.</li>
<li>Send a friend a <b>challenge</b>: the same Solitaire or Minesweeper game for everyone, and the results come back to the chat.</li>
<li>3D Pinball has <b>high scores</b> shared by everyone: see them on the <a href="games.html">Games &amp; Scores</a> page.</li>
</ul>
<h2>Add more with Windows Update</h2>
<p>Inside the program, <i>Windows Update</i> works like a store: pick themes, sounds, cursors, wallpapers, helpers and games, and install them with one click. You can look through everything first in the <a href="catalog.html">catalog</a>.</p>
<h2>Works everywhere</h2>
<table class="data"><tr><th>Device</th><th>How to get it</th></tr>
<tr><td>Windows</td><td>Installer or portable version, see <a href="download.html">Download</a></td></tr>
<tr class="alt"><td>Linux</td><td>AppImage or .deb package</td></tr>
<tr><td>Android</td><td>.apk file, Android 8.0 or newer</td></tr>
<tr class="alt"><td>iPhone / iPad</td><td>Installed with AltStore, iOS 16.4 or newer</td></tr>
<tr><td>Any browser</td><td><a href="{WEB}">Open the online version</a>, nothing to install</td></tr></table>
"""

T["en"]["pages"]["download"] = f"""
<h1>Download</h1>
<div class="box"><div class="title">Latest version</div><div class="body">{{{{LATEST_BOX}}}}</div></div>
{{{{DOWNLOADS}}}}
<h2>After you install it</h2>
<ol>
<li>Start Nekochat Reloaded and sign in with your <b>Nekochat</b> account. No account yet? Make one on <a href="{NEKOCHAT_SERVER}">the Nekochat server</a>.</li>
<li>Open <i>Windows Update</i> in the Control Panel to add themes, sounds, games and helpers.</li>
</ol>
<p>Prefer not to install anything? <a href="{WEB}">Use the online version.</a></p>
"""

T["en"]["pages"]["catalog"] = f"""
<h1>Themes and Games</h1>
{{{{CATALOG}}}}
"""

T["en"]["pages"]["games"] = f"""
<h1>Games and Scores</h1>
<p>Friends play the old Windows games together. Here you can see how many games are being played right now, and the best scores. The page refreshes itself every 30 seconds.</p>
<h2>Playing now: {{{{GAMES_COUNT}}}}</h2>
{{{{GAMES_LIVE}}}}
<h2>High scores</h2>
{{{{SCORES_TABLES}}}}
<p class="small">The scores are kept for each chat server. Every player has one best score, shown under the name they use in chat. Play 3D Pinball in Nekochat Reloaded to get on the list!</p>
"""

T["en"]["pages"]["help"] = f"""
<h1>Help</h1>
<h2>What is Nekochat?</h2>
<p>Nekochat is the chat service your friends use. <b>Nekochat Reloaded</b> is a program for it that looks like Windows XP and adds games, themes and more. You sign in with your Nekochat account.</p>
<h2>Do I need an account?</h2>
<p>Yes. Make one on <a href="{NEKOCHAT_SERVER}">the Nekochat server</a>, then sign in to Nekochat Reloaded with the same name and password.</p>
<h2>Is it free?</h2>
<p>Yes, everything here is free.</p>
<h2>How do I get new themes and games?</h2>
<p>Open <b>Windows Update</b> in the Control Panel of the program, tick what you like and press <b>Review and Install Items</b>. You can look at everything first in the <a href="catalog.html">catalog</a>.</p>
<h2>How do I play with a friend?</h2>
<p>Right-click the chat with your friend and choose <b>Play ...</b>. Your friend gets an invitation with a Play button. Games like Hearts and Spades can have up to four players.</p>
<h2>How do I send a big file?</h2>
<p>Click the paperclip next to the message box, or drag the file into the window. Tick <b>Infinity Memory</b> if your friend is not online: the file stays available by a link (up to 50 MB).</p>
<h2>How do I install it on an iPhone?</h2>
<p>The iPhone file is not signed by Apple, so it is installed with <a href="https://altstore.io">AltStore</a>. Download the .ipa file on the <a href="download.html">Download</a> page and open it with AltStore.</p>
<h2>Something does not work</h2>
<p>Write to us on <a href="{REPO}/issues">GitHub</a> and tell what happened and on which device. A screenshot helps a lot.</p>
"""

T["en"]["pages"]["about"] = f"""
<h1>About</h1>
<p>Nekochat Reloaded is a program for chatting with friends that looks and sounds like Windows XP. It is made by <b>KaMika</b> and the Nekochat Reloaded Team. The iPhone version is made together with VASHYAN-CMD.</p>
<p>This home page is made the way home pages looked around 2002.</p>
<h2>Links</h2>
<ul class="arrows">
<li><a href="{REPO}">Nekochat Reloaded on GitHub</a></li>
<li><a href="{REPO}/issues">Questions and ideas</a></li>
<li><a href="{OFFICIAL}">Nekochat</a>, the chat service it works with</li>
</ul>
<p class="small">Nekochat Reloaded is made by fans. It is not made by or connected with Microsoft. Windows and Windows XP are trademarks of Microsoft Corporation.</p>
"""

# ----------------------------------------------------------------------------------------------------------- Russian
T["ru"]["pages"]["index"] = f"""
<table class="head" width="100%" cellspacing="0" cellpadding="0"><tr><td><h1>Добро пожаловать в Nekochat Reloaded!</h1></td><td align="right" valign="top"><img src="/img/new.gif" width="42" height="16" alt="NEW!"></td></tr></table>
<div class="news"><marquee behavior="scroll" direction="left" scrollamount="3">*** {{{{LATEST_LINE}}}} *** Играйте с друзьями в Косынку, Червы, Реверси и 3D Pinball *** Отправляйте файлы в чатах, до 50 МБ *** Новые темы, звуки и помощники во встроенном Windows Update *** </marquee></div>
<p>&nbsp;</p>
<table class="tiles" cellspacing="0" cellpadding="0"><tr>
<td><a class="tile" href="download.html">Скачать<span>Windows, Linux, Android, iPhone</span></a></td>
<td><a class="tile" href="{WEB}">Попробовать онлайн<span>откройте прямо здесь, ничего ставить не нужно</span></a></td>
<td><a class="tile" href="catalog.html">Темы и игры<span>посмотрите, прежде чем ставить</span></a></td>
<td><a class="tile" href="games.html">Игры и рекорды<span>кто играет, лучшие результаты</span></a></td>
</tr></table>
<p>&nbsp;</p>
<table class="hero" cellspacing="0" cellpadding="0"><tr>
<td valign="top">
<p><b>Nekochat Reloaded</b> — программа для общения, которая выглядит и звучит как <b>Windows XP</b>. Общайтесь с друзьями, звоните, показывайте экран, отправляйте файлы и играйте вместе в старые игры Windows: Косынку, Червы, Реверси, Pinball и другие.</p>
<p>Работает на <b>Windows, Linux, Android и iPhone</b>, а также <b>в браузере</b>.</p>
<p><img src="/img/bullet-red.gif" width="11" height="11" alt="*"> {{{{HOME_DOWNLOAD}}}}</p>
<p><img src="/img/bullet-red.gif" width="11" height="11" alt="*"> Или <a href="{WEB}"><b>попробуйте онлайн</b></a> прямо сейчас, ничего ставить не нужно.</p>
<h2>Начните за три шага</h2>
<ol>
<li><b>Скачайте</b> программу для своего устройства или откройте онлайн-версию.</li>
<li><b>Войдите</b> со своей учётной записью Nekochat. Ещё нет учётной записи? Создайте её на <a href="{NEKOCHAT_SERVER}">сервере Nekochat</a>.</li>
<li><b>Настройте под себя:</b> откройте <i>Windows Update</i> в Панели управления, чтобы добавить темы, звуки, игры и помощников.</li>
</ol>
</td>
<td width="14">&nbsp;</td>
<td valign="top" width="590"><img class="shot" src="/img/screenshot.png" width="560" alt="Окно Nekochat Reloaded"><br><span class="small">Nekochat Reloaded с темой Windows XP.</span></td>
</tr></table>
<h2>Посмотрите в деле</h2>
{{{{GALLERY}}}}
<p><a href="catalog.html">Все темы и игры &raquo;</a></p>
"""

T["ru"]["pages"]["features"] = f"""
<h1>Что умеет</h1>
<h2>Общение с друзьями</h2>
<ul class="arrows">
<li>Групповые чаты (комнаты) и личные сообщения, реакции, закреплённые сообщения и отметки: кто печатает и кто прочитал.</li>
<li>Любой чат можно открыть в отдельном окне, как в старых мессенджерах.</li>
<li>Голосовые звонки и показ экрана.</li>
<li>Ваш статус: в сети, отошёл, не беспокоить или невидимка.</li>
</ul>
<h2>Отправка файлов</h2>
<ul class="arrows">
<li>Нажмите скрепку, перетащите файл в окно или вставьте его.</li>
<li>Отметьте <b>Infinity Memory</b>, чтобы файл (до 50 МБ) остался доступен по ссылке: друг, который был не в сети, всё равно его получит.</li>
</ul>
<h2>Выглядит и звучит как Windows XP</h2>
<ul class="arrows">
<li>Знакомый синий вид Luna, серый вид Classic и другие темы на выбор. Тему используют все окна.</li>
<li>Знаменитые звуки Windows XP, а курсоры и значки можно менять.</li>
<li>Панель управления, Центр справки и поддержки и помощники <b>Rover, Merlin, Courtney и Earl</b>.</li>
</ul>
<h2>Играйте вместе</h2>
<ul class="arrows">
<li>Косынка, Паук, FreeCell, Червы, Пики, Реверси, Шашки, Нарды, Сапёр и 3D Pinball с оригинальными картами, досками и звуками.</li>
<li>Играйте с компьютером или пригласите друга из чата.</li>
<li>Отправьте другу <b>вызов</b>: у всех одна и та же партия Косынки или Сапёра, а результаты приходят в чат.</li>
<li>У 3D Pinball есть <b>общие рекорды</b>: смотрите их на странице <a href="games.html">Игры и рекорды</a>.</li>
</ul>
<h2>Добавляйте новое через Windows Update</h2>
<p>Внутри программы <i>Windows Update</i> работает как магазин: выберите темы, звуки, курсоры, обои, помощников и игры и установите их одним нажатием. Сначала можно всё посмотреть в <a href="catalog.html">каталоге</a>.</p>
<h2>Работает везде</h2>
<table class="data"><tr><th>Устройство</th><th>Как получить</th></tr>
<tr><td>Windows</td><td>Установщик или портативная версия, см. <a href="download.html">Скачать</a></td></tr>
<tr class="alt"><td>Linux</td><td>AppImage или пакет .deb</td></tr>
<tr><td>Android</td><td>Файл .apk, Android 8.0 и новее</td></tr>
<tr class="alt"><td>iPhone / iPad</td><td>Устанавливается через AltStore, iOS 16.4 и новее</td></tr>
<tr><td>Любой браузер</td><td><a href="{WEB}">Откройте онлайн-версию</a>, ничего ставить не нужно</td></tr></table>
"""

T["ru"]["pages"]["download"] = f"""
<h1>Скачать</h1>
<div class="box"><div class="title">Последняя версия</div><div class="body">{{{{LATEST_BOX}}}}</div></div>
{{{{DOWNLOADS}}}}
<h2>После установки</h2>
<ol>
<li>Запустите Nekochat Reloaded и войдите со своей учётной записью <b>Nekochat</b>. Ещё нет учётной записи? Создайте её на <a href="{NEKOCHAT_SERVER}">сервере Nekochat</a>.</li>
<li>Откройте <i>Windows Update</i> в Панели управления, чтобы добавить темы, звуки, игры и помощников.</li>
</ol>
<p>Не хотите ничего ставить? <a href="{WEB}">Используйте онлайн-версию.</a></p>
"""

T["ru"]["pages"]["catalog"] = f"""
<h1>Темы и игры</h1>
{{{{CATALOG}}}}
"""

T["ru"]["pages"]["games"] = f"""
<h1>Игры и рекорды</h1>
<p>Друзья вместе играют в старые игры Windows. Здесь видно, сколько игр идёт прямо сейчас, и лучшие результаты. Страница обновляется сама каждые 30 секунд.</p>
<h2>Играют сейчас: {{{{GAMES_COUNT}}}}</h2>
{{{{GAMES_LIVE}}}}
<h2>Рекорды</h2>
{{{{SCORES_TABLES}}}}
<p class="small">Результаты хранятся отдельно для каждого чат-сервера. У каждого игрока один лучший результат, он показан под именем, которое игрок использует в чате. Сыграйте в 3D Pinball в Nekochat Reloaded, чтобы попасть в список!</p>
"""

T["ru"]["pages"]["help"] = f"""
<h1>Помощь</h1>
<h2>Что такое Nekochat?</h2>
<p>Nekochat — чат, которым пользуются ваши друзья. <b>Nekochat Reloaded</b> — программа для него, похожая на Windows XP, с играми, темами и другим. Вы входите со своей учётной записью Nekochat.</p>
<h2>Нужна ли учётная запись?</h2>
<p>Да. Создайте её на <a href="{NEKOCHAT_SERVER}">сервере Nekochat</a> и войдите в Nekochat Reloaded с тем же именем и паролем.</p>
<h2>Это бесплатно?</h2>
<p>Да, всё здесь бесплатно.</p>
<h2>Как получить новые темы и игры?</h2>
<p>Откройте <b>Windows Update</b> в Панели управления программы, отметьте нужное и нажмите <b>Review and Install Items</b>. Сначала можно всё посмотреть в <a href="catalog.html">каталоге</a>.</p>
<h2>Как сыграть с другом?</h2>
<p>Нажмите правой кнопкой на чат с другом и выберите <b>Play ...</b>. Друг получит приглашение с кнопкой Play. В Червы и Пики могут играть до четырёх человек.</p>
<h2>Как отправить большой файл?</h2>
<p>Нажмите скрепку рядом с полем сообщения или перетащите файл в окно. Отметьте <b>Infinity Memory</b>, если друга нет в сети: файл останется доступен по ссылке (до 50 МБ).</p>
<h2>Как поставить на iPhone?</h2>
<p>Файл для iPhone не подписан Apple, поэтому его ставят через <a href="https://altstore.io">AltStore</a>. Скачайте файл .ipa на странице <a href="download.html">Скачать</a> и откройте его в AltStore.</p>
<h2>Что-то не работает</h2>
<p>Напишите нам на <a href="{REPO}/issues">GitHub</a>: что случилось и на каком устройстве. Очень помогает скриншот.</p>
"""

T["ru"]["pages"]["about"] = f"""
<h1>О проекте</h1>
<p>Nekochat Reloaded — программа для общения с друзьями, которая выглядит и звучит как Windows XP. Её делает <b>KaMika</b> и команда Nekochat Reloaded. Версия для iPhone делается вместе с VASHYAN-CMD.</p>
<p>Эта домашняя страница сделана так, как выглядели домашние страницы около 2002 года.</p>
<h2>Ссылки</h2>
<ul class="arrows">
<li><a href="{REPO}">Nekochat Reloaded на GitHub</a></li>
<li><a href="{REPO}/issues">Вопросы и идеи</a></li>
<li><a href="{OFFICIAL}">Nekochat</a> — чат, с которым это работает</li>
</ul>
<p class="small">Nekochat Reloaded сделан поклонниками. Он не создан Microsoft и не связан с ней. Windows и Windows XP — товарные знаки Microsoft Corporation.</p>
"""


T["en"]["pages"]["watch"] = f"""
<h1>Watching: <span id="watch-title">a game</span></h1>
<p><a href="games.html">&laquo; Back to Games &amp; Scores</a></p>
<p><b id="watch-status">Loading the game...</b> &nbsp; Players: <b id="watch-players">-</b> &nbsp; Watching: <b id="watch-count">-</b></p>
<div id="watch-stage" class="watchbox" hidden><iframe id="watch-frame" title="The game" allow="autoplay"></iframe></div>
<p class="small">You are a spectator: you see the game as the players play it, you cannot move. Cards that players hold in their hands stay hidden.</p>
<script src="/watch.js?v={BUILD}"></script>
"""

T["ru"]["pages"]["watch"] = f"""
<h1>Смотрим: <span id="watch-title">игру</span></h1>
<p><a href="games.html">&laquo; К странице «Игры и рекорды»</a></p>
<p><b id="watch-status">Загрузка игры...</b> &nbsp; Игроки: <b id="watch-players">-</b> &nbsp; Смотрят: <b id="watch-count">-</b></p>
<div id="watch-stage" class="watchbox" hidden><iframe id="watch-frame" title="Игра" allow="autoplay"></iframe></div>
<p class="small">Вы зритель: видите игру так, как её видят игроки, но ходить нельзя. Карты на руках у игроков скрыты.</p>
<script src="/watch.js?v={BUILD}"></script>
"""

def page(lang, name):
    t = T[lang]
    here = t["dir"]
    nav = "".join(
        (f'<a href="/{here}{p}.html"{" class=\"here\"" if p == name else ""}>{t["nav"][p]}</a>' if p != "index" else
         f'<a href="/{here}"{" class=\"here\"" if p == name else ""}>{t["nav"][p]}</a>')
        for p in ORDER)
    other_url = ("/" if lang == "ru" else "/ru/") + ("" if name == "index" else f"{name}.html") + (" " if False else "")
    now = datetime.date.today().strftime("%d %B %Y") if lang == "en" else datetime.date.today().strftime("%d.%m.%Y")
    refresh = '<meta http-equiv="refresh" content="30">' if name == "games" else ""
    return f"""<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html lang="{t['lang']}">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nekochat Reloaded - {t['titles'][name]}</title>
<meta name="description" content="Nekochat Reloaded - a chat program that looks and sounds like Windows XP">
<link rel="stylesheet" href="/style.css?v={BUILD}" type="text/css">
{refresh}
<link rel="shortcut icon" href="/favicon.ico">
</head>
<body background="/img/bg.gif" bgcolor="#e2eaf7">
<table class="outer" cellspacing="0" cellpadding="0" border="0">
<tr><td colspan="2" class="top"><a href="/{here}"><img class="banner" src="/img/banner.png" width="760" height="100" alt="Nekochat Reloaded"></a></td></tr>
<tr>
<td class="nav" valign="top">
<div class="head">{t['menu']}</div>
{nav}
<a href="{WEB}" class="special">{t['webclient']}</a>
<div class="head">{t['search']}</div>
<form action="/{here}catalog.html" method="get"><input type="text" name="q" size="12"> <input type="submit" value="{t['go']}"></form>
<div class="head">{t['language']}</div>
<a href="{other_url}">{t['other_name']}</a>
</td>
<td class="main" valign="top">
{t['pages'][name]}
<p align="center"><img src="/img/rainbow.gif" width="520" height="4" alt=""></p>
<p align="center" class="small">{t['best']}</p>
</td>
</tr>
<tr><td colspan="2" class="foot">
<p>{t['visitor']} <img class="counter" src="/counter.svg" width="96" height="22" alt="visitor counter"></p>
<p><img src="/img/btn-ie6.gif" width="88" height="31" alt="Best viewed in Internet Explorer 6"> <img src="/img/btn-res.gif" width="88" height="31" alt="1024 x 768"> <img src="/img/btn-nekochat.gif" width="88" height="31" alt="Nekochat Reloaded"></p>
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
    for old in ("addons", "server", "status"):   # pages of an older version of the site (the server redirects them)
        path = os.path.join(out, f"{old}.html")
        if os.path.exists(path):
            os.remove(path)
    for name in ORDER + EXTRA:
        with open(os.path.join(out, f"{name}.html"), "w", encoding="utf-8") as f:
            f.write(page(lang, name))
print("pages written")
