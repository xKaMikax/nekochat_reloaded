// Help and Support Center, like Windows XP's: the toolbar (Back, Forward, Home, Index,
// Favorites, History, Support, Options), the search band, the topic tree on the left and the
// topic page on the right. Every topic of the client is here, in Russian and English.
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const words = {
  ru: { title: 'Центр справки и поддержки', back: 'Назад', forward: 'Вперёд', home: 'Домой', index: 'Указатель', favorites: 'Избранное', history: 'Журнал', support: 'Поддержка', options: 'Параметры', search: 'Поиск', searchHint: 'Введите слово и нажмите стрелку', addFavorite: 'Добавить в избранное', changeView: 'Изменить вид', print: 'Печать...', locate: 'Найти в содержании', close: 'Закрыть',
    contents: 'Разделы справки', seeAlso: 'См. также', pickTopic: 'Выберите раздел справки', tasks: 'Выберите задание', results: 'Результаты поиска', noResults: 'Ничего не найдено. Попробуйте другое слово.', indexTitle: 'Указатель', indexHint: 'Введите слово, чтобы найти его в указателе:', favoritesTitle: 'Избранное', favoritesEmpty: 'В избранном пока ничего нет. Откройте раздел и нажмите «Добавить в избранное».', historyTitle: 'Журнал', historyEmpty: 'Вы ещё не открывали разделы справки.', remove: 'Удалить', added: 'Раздел добавлен в избранное.', optionsTitle: 'Параметры', optionsText: 'Язык справки совпадает с языком приложения (Панель управления → Язык и региональные стандарты). Размер шрифта задаётся в Панели управления → Экран → Оформление.',
    taskUpdates: 'Проверить обновления', askTitle: 'Помощь', askBug: 'Сообщить о проблеме в <b>разделе Issues</b> на GitHub', askProject: 'Узнать о новых версиях на <b>странице Nekochat Reloaded</b>', taskUpdates2: 'Поддерживайте клиент в актуальном состоянии с помощью <b>Автоматического обновления</b>', taskControl2: 'Настройте внешний вид и звуки в <b>Панели управления</b>', taskCatalog2: 'Установите темы, курсоры, звуки и помощников из <b>Каталога</b>', taskBackup: 'Сохраните настройки с помощью <b>Архивации</b>', didYouKnow: 'А вы знаете?', suggested: 'Предлагаемые разделы', helpTopics: 'Разделы справки', tipsLink: 'Советы', browseTitle: 'Просмотр результатов поиска', browse1: 'Щёлкните результат, чтобы открыть раздел.', browse2: 'Щёлкайте заголовки, чтобы увидеть результаты из разных источников.', browse3: 'Не нашли нужного? Попробуйте другое слово.', browse4: 'Ищете способ быстрее находить разделы? Попробуйте', options1: 'С помощью параметров можно настроить Центр справки и поддержки.', options2: 'Измените, как выглядит Центр справки и поддержки.', options3: 'Настройте поиск, чтобы находить нужное быстрее.', optionsCenter: 'Изменить параметры Центра справки и поддержки', optionsSearch: 'Настроить параметры поиска', optionsSearchText: 'Выберите, как искать разделы справки.', optHighlight: 'Подсвечивать найденные слова', optTitle: 'Искать только в заголовках и ключевых словах', taskControl: 'Открыть Панель управления', taskCatalog: 'Открыть Каталог', taskBug: 'Сообщить об ошибке', seeKeys: 'Сочетания клавиш', seeTrouble: 'Устранение неполадок', seeGithub: 'Nekochat Reloaded на GitHub' },
  en: { title: 'Help and Support Center', back: 'Back', forward: 'Forward', home: 'Home', index: 'Index', favorites: 'Favorites', history: 'History', support: 'Support', options: 'Options', search: 'Search', searchHint: 'Type a word and click the arrow', addFavorite: 'Add to Favorites', changeView: 'Change View', print: 'Print...', locate: 'Locate in Contents', close: 'Close',
    contents: 'Help Contents', seeAlso: 'See Also', pickTopic: 'Pick a Help topic', tasks: 'Pick a task', results: 'Search Results', noResults: 'Nothing found. Try another word.', indexTitle: 'Index', indexHint: 'Type in the keyword to find:', favoritesTitle: 'Favorites', favoritesEmpty: 'There is nothing in Favorites yet. Open a topic and click Add to Favorites.', historyTitle: 'History', historyEmpty: 'You have not opened any Help topics yet.', remove: 'Remove', added: 'The topic was added to Favorites.', optionsTitle: 'Options', optionsText: 'Help uses the language of the app (Control Panel → Regional and Language Options). The font size is set in Control Panel → Display → Appearance.',
    taskUpdates: 'Check for updates', askTitle: 'Ask for assistance', askBug: 'Report a problem in the <b>Issues</b> on GitHub', askProject: 'Read about new versions on the <b>Nekochat Reloaded page</b>', taskUpdates2: 'Keep the client up-to-date with <b>Automatic Updates</b>', taskControl2: 'Change the look and sounds in the <b>Control Panel</b>', taskCatalog2: 'Install themes, cursors, sounds and assistants from the <b>Catalog</b>', taskBackup: 'Save your settings with <b>Backup</b>', didYouKnow: 'Did you know?', suggested: 'Suggested Topics', helpTopics: 'Help Topics', tipsLink: 'Tips', browseTitle: 'Browse the search results', browse1: 'Click a result to display the information.', browse2: 'Click the headers to see search results from different sources.', browse3: 'Didn\'t find what you\'re looking for? Try another word.', browse4: 'Looking for more ways to find Help topics quickly and easily? Try the', options1: 'Use options to define settings and configure Help and Support Center.', options2: 'Change how you use and view Help and Support Center.', options3: 'Set search options to find help faster.', optionsCenter: 'Change Help and Support Center options', optionsSearch: 'Set search options', optionsSearchText: 'Choose how Help topics are searched.', optHighlight: 'Turn on search highlight', optTitle: 'Search in titles and keywords only', taskControl: 'Open Control Panel', taskCatalog: 'Open the Catalog', taskBug: 'Report a problem', seeKeys: 'Keyboard shortcuts', seeTrouble: 'Troubleshooting', seeGithub: 'Nekochat Reloaded on GitHub' },
};
// Topics: id, title, text (HTML, may link to other topics with data-topic), children.
const TOPICS = {
  ru: [
    { id: 'start', title: 'Начало работы', icon: 'users', keys: ['вход', 'аккаунт', 'сервер', 'регистрация'], text: '<p>Nekochat Reloaded — неофициальный клиент Nekochat в стиле Windows XP. Он работает на Windows, Linux, Android, iPhone и в браузере.</p><h3>Вход</h3><p>На экране приветствия щёлкните свою учётную запись. Если её нет, нажмите <b>Другой пользователь</b>, введите имя и пароль или создайте учётную запись.</p><h3>Несколько учётных записей</h3><p>Клиент помнит все учётные записи, в которые вы входили, даже на разных серверах. Сменить учётную запись можно кнопкой <b>Сменить пользователя</b> в окне профиля. Экран приветствия показывает, сколько непрочитанных сообщений было у каждой учётной записи.</p><h3>Сервер</h3><p><b>Сменить URL сервера</b> внизу экрана приветствия позволяет войти на другой сервер Nekochat.</p>' },
    { id: 'chats', title: 'Чаты и сообщения', icon: 'network', keys: ['сообщение', 'комната', 'личные'], text: '<p>Слева — список комнат и личных чатов, справа — открытый чат. Правой кнопкой по чату можно добавить его в избранное, выключить звук, выбрать свой звук уведомлений или перенести в архив.</p>', children: [
      { id: 'replies', title: 'Ответы, реакции и закрепы', keys: ['ответ', 'реакция', 'закреп', 'pin'], text: '<p>Меню сообщения открывается кнопкой <b>⋯</b> рядом со временем или правой кнопкой.</p><ul><li><b>Ответить</b> — ответ начнётся с цитаты сообщения.</li><li><b>Реакции</b> — щёлкните реакцию под сообщением, чтобы добавить или убрать свою.</li><li><b>Закрепить</b> — закреплённые сообщения открываются кнопкой с булавкой в заголовке чата.</li></ul><p>Реакции, закрепы, «печатает…» и отметки о прочтении видят пользователи Nekochat Reloaded.</p>' },
      { id: 'format', title: 'Оформление текста и упоминания', keys: ['жирный', 'курсив', 'код', 'упоминание', '@'], text: '<ul><li><code>**жирный**</code>, <code>*курсив*</code>, <code>~~зачёркнутый~~</code>, <code>`код`</code> и блоки кода в тройных кавычках.</li><li>Наберите <b>@</b>, чтобы упомянуть человека. Упоминание оповещает даже в чате с выключенным звуком.</li><li>Ссылки открываются в браузере и показывают карточку с описанием страницы.</li></ul>' },
      { id: 'search', title: 'Поиск сообщений', keys: ['поиск', 'найти', 'rover'], text: '<p><b>Ctrl+F</b> ищет в открытом чате, <b>Enter</b> переходит к следующему совпадению.</p><p>Чтобы искать во всех чатах сразу, щёлкните помощника (Rover) и выберите <b>Найти сообщения во всех чатах</b>. Откроется помощник по поиску: укажите слово, где искать и от кого. Щелчок по результату открывает чат и подсвечивает найденное.</p>' },
      { id: 'organize', title: 'Черновики, избранное, архив и заметки', keys: ['черновик', 'избранное', 'архив', 'заметка'], text: '<ul><li>Неотправленный текст сохраняется в каждом чате и переходит на другие устройства.</li><li>Избранные чаты всегда наверху списка.</li><li>Архив — в конце списка; архивные чаты не мешают.</li><li>В профиле человека можно оставить заметку, которую видите только вы.</li></ul>' },
      { id: 'chat-sounds', title: 'Звуки чатов', keys: ['звук', 'уведомление', 'громкость'], text: '<p>Правой кнопкой по чату → <b>Звук уведомлений…</b>: свой звук (или «Нет») и громкость для этого чата. Общая звуковая схема и громкость — в Панели управления → Звуки и аудиоустройства.</p>' },
    ] },
    { id: 'calls', title: 'Звонки и демонстрация экрана', icon: 'sounds', keys: ['звонок', 'микрофон', 'экран', 'голос'], text: '<p>Кнопка с трубкой в заголовке чата начинает звонок. Во время звонка можно выключить микрофон и показать свой экран.</p><p>Микрофон и шумоподавление выбираются в Панели управления → Звуки и аудиоустройства → Аудио. Кодек демонстрации экрана — в Сетевых подключениях.</p>' },
    { id: 'assistant', title: 'Помощник', icon: 'assistant', keys: ['rover', 'собака', 'помощник', 'merlin'], text: '<p>Помощник — персонаж вроде Rover (помощник по поиску из Windows XP), Merlin, Earl или Courtney. Он сидит в окне чата; его можно перетащить.</p><ul><li>Помощников нет, пока вы не установили хотя бы одного: откройте Панель управления → Windows Update → Помощники. Пока ни одного нет, раздел «Помощник» в Панели управления скрыт.</li><li>Щелчок по нему: найти сообщения во всех чатах, непрочитанные, перейти к чату, найти в этом чате, сменить статус, совет, скрыть.</li><li>Пока вы ищете, он ищет вместе с вами, а при упоминании — зовёт.</li><li>Выбрать или отключить помощника можно в Панели управления → Помощник.</li></ul>' },
    { id: 'control', title: 'Панель управления', icon: 'control-panel', keys: ['панель', 'настройки', 'тема', 'обои', 'курсор'], text: '<p>Панель управления открывается кнопкой в окне профиля. В ней есть вид по категориям и классический вид.</p>', children: [
      { id: 'display', title: 'Экран: темы, рабочий стол, оформление', keys: ['тема', 'фон', 'обои', 'шрифт', 'эффекты', 'цветовая схема'], text: '<ul><li><b>Темы</b> — Luna, Classic и темы из Каталога или файлов .msstyles.</li><li><b>Рабочий стол</b> — фон чата: картинка, расположение (растянуть, по центру, замостить) и цвет.</li><li><b>Оформление</b> — цветовая схема, размер шрифта, <b>Эффекты…</b> и <b>Дополнительно…</b>.</li><li>У темы Classic есть 22 классические схемы Windows XP.</li></ul>' },
      { id: 'mouse', title: 'Мышь и значки', keys: ['курсор', 'указатель', 'значки'], text: '<p>Панель управления → Мышь → Указатели: курсоры Windows XP, системные или пак из Каталога. Значки приложения выбираются в Экран → Параметры.</p>' },
      { id: 'updates', title: 'Автоматическое обновление', keys: ['обновление', 'версия', 'бета'], text: '<p>Панель управления → Автоматическое обновление: автоматически, загружать и спрашивать, только уведомлять или отключить. Там же можно получать бета-версии и проверить обновления сейчас.</p>' },
    ] },
    { id: 'catalog', title: 'Каталог', icon: 'catalog', keys: ['каталог', 'установить', 'пак', 'комбо', 'опубликовать'], text: '<p>Каталог устанавливает темы, курсоры, звуки, значки, обои для чата, помощников и комбо (набор из нескольких).</p><p>Свои темы и паки можно опубликовать в репозитории <b>nekochat_reloaded_themes</b> на GitHub; как это сделать, описано в его папке <code>docs</code>.</p>' },
    { id: 'privacy', title: 'Учётные записи и конфиденциальность', icon: 'users', keys: ['статус', 'отошёл', 'последний визит', 'профиль', 'рисунок'], text: '<ul><li>Панель управления → Учётные записи: имя, пароль (нужен текущий, не короче 6 символов), статус и описание, рисунок (в том числе картинки Windows XP), баннер и цвет профиля — для любой учётной записи клиента.</li><li><b>Настроить конфиденциальность</b>: показывать ли, когда вы были в сети, и через сколько минут без действий ставить статус «Отошёл».</li></ul>' },
    { id: 'keys', title: 'Сочетания клавиш', icon: 'keyboard', keys: ['клавиши', 'ctrl', 'горячие'], text: '<table class="help-table"><tr><td><b>Ctrl+K</b></td><td>Перейти к чату</td></tr><tr><td><b>Ctrl+F</b></td><td>Поиск в открытом чате</td></tr><tr><td><b>Enter</b> / <b>Shift+Enter</b></td><td>Следующее / предыдущее совпадение</td></tr><tr><td><b>Alt+↑</b>, <b>Alt+↓</b></td><td>Листать список чатов</td></tr><tr><td><b>Esc</b></td><td>Закрыть меню, поиск или ответ</td></tr><tr><td><b>Alt+←</b>, <b>Alt+→</b></td><td>Назад и вперёд в Панели управления и Справке</td></tr></table>' },
    { id: 'backups', title: 'Резервные копии', icon: 'backups', keys: ['резервная', 'копия', 'восстановить'], text: '<p>Панель управления → Архивация: сохраняет настройки, темы, картинки и список учётных записей на сервере Nekochat Reloaded. Пароли и сеансы в копию не попадают. При восстановлении можно выбрать, что вернуть.</p>' },
    { id: 'trouble', title: 'Устранение неполадок', icon: 'help', keys: ['не работает', 'ошибка', 'звук', 'подключение'], text: '<ul><li><b>Нет звука</b> — проверьте звуковую схему и громкость (Звуки и аудиоустройства) и звук этого чата (правой кнопкой по чату).</li><li><b>Не подключается</b> — проверьте адрес сервера на экране приветствия и сервер Nekochat Reloaded в Сетевых подключениях.</li><li><b>Реакции и «последний визит» не видны</b> — их видят только пользователи Nekochat Reloaded, и должен быть включён сервер Nekochat Reloaded.</li><li><b>Не приходят обновления</b> — Панель управления → Автоматическое обновление → Проверить сейчас.</li></ul>' },
  ],
  en: [
    { id: 'start', title: 'Getting started', icon: 'users', keys: ['log on', 'account', 'server', 'register'], text: '<p>Nekochat Reloaded is an unofficial Nekochat client in the style of Windows XP. It runs on Windows, Linux, Android, iPhone and in the browser.</p><h3>Logging on</h3><p>Click your account on the Welcome screen. If it is not there, click <b>Other user</b> and type your name and password, or create an account.</p><h3>Several accounts</h3><p>The client remembers every account you logged on with, even on other servers. <b>Change user</b> in the profile window switches accounts. The Welcome screen shows how many unread messages each account had.</p><h3>Server</h3><p><b>Change server URL</b> at the bottom of the Welcome screen logs on to another Nekochat server.</p>' },
    { id: 'chats', title: 'Chats and messages', icon: 'network', keys: ['message', 'room', 'direct'], text: '<p>Rooms and direct chats are on the left, the open chat on the right. Right-click a chat to favourite it, mute it, choose its notification sound or archive it.</p>', children: [
      { id: 'replies', title: 'Replies, reactions and pins', keys: ['reply', 'reaction', 'pin'], text: '<p>A message\'s menu opens with <b>⋯</b> next to its time, or a right click.</p><ul><li><b>Reply</b> starts your message with a quote.</li><li><b>Reactions</b>: click a reaction under a message to add or remove yours.</li><li><b>Pin</b>: the pin button in the chat header lists pinned messages.</li></ul><p>Reactions, pins, typing and read receipts are seen by Nekochat Reloaded users.</p>' },
      { id: 'format', title: 'Formatting and mentions', keys: ['bold', 'italic', 'code', 'mention', '@'], text: '<ul><li><code>**bold**</code>, <code>*italic*</code>, <code>~~strikethrough~~</code>, <code>`code`</code> and code blocks.</li><li>Type <b>@</b> to mention someone. A mention notifies even in a muted chat.</li><li>Links open in your browser and show a preview card.</li></ul>' },
      { id: 'search', title: 'Searching messages', keys: ['search', 'find', 'rover'], text: '<p><b>Ctrl+F</b> searches the open chat; <b>Enter</b> goes to the next match.</p><p>To search all chats, click the assistant (if you installed one) and choose <b>Search messages in all chats</b>. The Search Companion opens: the words, where to look and from whom. A result opens the chat and highlights the words.</p>' },
      { id: 'organize', title: 'Drafts, favourites, archive and notes', keys: ['draft', 'favourite', 'archive', 'note'], text: '<ul><li>Unsent text stays in each chat and follows you to your other devices.</li><li>Favourite chats stay at the top of the list.</li><li>The archive is at the end of the list.</li><li>A private note about a person can be kept in their profile.</li></ul>' },
      { id: 'chat-sounds', title: 'Chat sounds', keys: ['sound', 'notification', 'volume'], text: '<p>Right-click a chat → <b>Notification sound…</b>: its own sound (or none) and volume. The sound scheme and volume are in Control Panel → Sounds and Audio Devices.</p>' },
    ] },
    { id: 'calls', title: 'Calls and screen sharing', icon: 'sounds', keys: ['call', 'microphone', 'screen', 'voice'], text: '<p>The phone button in the chat header starts a call. During a call you can mute the microphone and share your screen.</p><p>The microphone and noise suppression are in Control Panel → Sounds and Audio Devices → Audio; the screen sharing codec is in Network Connections.</p>' },
    { id: 'assistant', title: 'The assistant', icon: 'assistant', keys: ['rover', 'dog', 'assistant', 'merlin'], text: '<p>An assistant is a character like Rover (the search companion of Windows XP), Merlin, Earl or Courtney. He sits in the chat window; drag him anywhere.</p><ul><li>There are none until you install one: open Control Panel → Windows Update → Assistants. While none is installed, the Assistant item in Control Panel is hidden.</li><li>Click him: search all chats, unread chats, go to a chat, search this chat, change status, a tip, hide.</li><li>He searches while you search and calls you on mentions.</li><li>Choose or turn off the assistant in Control Panel → Assistant.</li></ul>' },
    { id: 'control', title: 'Control Panel', icon: 'control-panel', keys: ['control panel', 'settings', 'theme', 'wallpaper', 'cursor'], text: '<p>The Control Panel opens from the profile window. It has a category view and a classic view.</p>', children: [
      { id: 'display', title: 'Display: themes, desktop, appearance', keys: ['theme', 'background', 'wallpaper', 'font', 'effects', 'colour scheme'], text: '<ul><li><b>Themes</b>: Luna, Classic and themes from the Catalog or .msstyles files.</li><li><b>Desktop</b>: the chat background, its position (stretch, center, tile) and colour.</li><li><b>Appearance</b>: colour scheme, font size, <b>Effects…</b> and <b>Advanced…</b>.</li><li>The Classic theme has the 22 classic schemes of Windows XP.</li></ul>' },
      { id: 'mouse', title: 'Mouse and icons', keys: ['cursor', 'pointer', 'icons'], text: '<p>Control Panel → Mouse → Pointers: Windows XP cursors, system ones or a Catalog pack. The app\'s icons are chosen in Display → Settings.</p>' },
      { id: 'updates', title: 'Automatic Updates', keys: ['update', 'version', 'beta'], text: '<p>Control Panel → Automatic Updates: automatic, download and ask, notify only or off. You can also get beta versions and check now.</p>' },
    ] },
    { id: 'catalog', title: 'The Catalog', icon: 'catalog', keys: ['catalog', 'install', 'pack', 'combo', 'publish'], text: '<p>The Catalog installs themes, cursors, sounds, icons, chat wallpapers, assistants and combos.</p><p>Publish your own themes and packs in the <b>nekochat_reloaded_themes</b> repository on GitHub; its <code>docs</code> folder explains how.</p>' },
    { id: 'privacy', title: 'Accounts and privacy', icon: 'users', keys: ['status', 'away', 'last seen', 'profile', 'picture'], text: '<ul><li>Control Panel → User Accounts: name, password (needs the current one, at least 6 characters), status and bio, picture (including Windows XP pictures), banner and profile colour — for any account on this client.</li><li><b>Change privacy options</b>: whether others see when you were last online, and when to set you to Away.</li></ul>' },
    { id: 'keys', title: 'Keyboard shortcuts', icon: 'keyboard', keys: ['keys', 'ctrl', 'shortcut'], text: '<table class="help-table"><tr><td><b>Ctrl+K</b></td><td>Go to a chat</td></tr><tr><td><b>Ctrl+F</b></td><td>Search the open chat</td></tr><tr><td><b>Enter</b> / <b>Shift+Enter</b></td><td>Next / previous match</td></tr><tr><td><b>Alt+↑</b>, <b>Alt+↓</b></td><td>Move through the chat list</td></tr><tr><td><b>Esc</b></td><td>Close menus, the search or a reply</td></tr><tr><td><b>Alt+←</b>, <b>Alt+→</b></td><td>Back and Forward in the Control Panel and Help</td></tr></table>' },
    { id: 'backups', title: 'Backups', icon: 'backups', keys: ['backup', 'restore'], text: '<p>Control Panel → Backup keeps your settings, themes, pictures and account list on the Nekochat Reloaded server. Passwords and sessions are never included. When restoring, choose what to bring back.</p>' },
    { id: 'trouble', title: 'Troubleshooting', icon: 'help', keys: ['not working', 'error', 'sound', 'connection'], text: '<ul><li><b>No sound</b>: check the sound scheme and volume (Sounds and Audio Devices) and the chat\'s own sound (right-click the chat).</li><li><b>Cannot connect</b>: check the server address on the Welcome screen and the Nekochat Reloaded server in Network Connections.</li><li><b>Reactions or "last seen" missing</b>: only Nekochat Reloaded users see them, with the Nekochat Reloaded server turned on.</li><li><b>No updates</b>: Control Panel → Automatic Updates → Check now.</li></ul>' },
  ],
};
let language = 'ru';
const t = key => words[language][key];
const topics = () => TOPICS[language];
const flat = () => topics().flatMap(topic => [topic, ...(topic.children || []).map(child => ({ ...child, parent: topic.id }))]);
const topicById = id => flat().find(topic => topic.id === id);
const stored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const cpIcon = name => `assets/images/control-panel/${name}.png`;

// Pages: 'home', 'topic:<id>', 'search:<words>', 'index', 'favorites', 'history', 'options'.
let page = new URLSearchParams(location.search).get('topic') ? `topic:${new URLSearchParams(location.search).get('topic')}` : 'home';
const back = [], forward = [];
let open = new Set(['chats', 'control']);
function go(next) { if (next === page) { render(); return; } window.nkPlaySound?.('navigation'); back.push(page); forward.length = 0; page = next; render(); }
function step(from, to) { if (!from.length) return; window.nkPlaySound?.('navigation'); to.push(page); page = from.pop(); render(); }

function tree(current) {
  const item = topic => `<button type="button" class="help-node${topic.id === current ? ' selected' : ''}" data-topic="${topic.id}">${topic.children ? `<img class="help-toggle" data-toggle="${topic.id}" src="assets/images/help/${open.has(topic.id) ? 'minus' : 'plus'}.png" alt="">` : '<img class="help-toggle" src="assets/images/help/topic.png" alt="">'}<span>${esc(topic.title)}</span></button>`
    + (topic.children && open.has(topic.id) ? `<div class="help-children">${topic.children.map(item).join('')}</div>` : '');
  return `<section class="cp-box help-box"><h2><span>${esc(t('contents'))}</span></h2><div class="cp-box-body help-tree">${topics().map(item).join('')}</div></section>`
    + `<section class="cp-box help-box"><h2><span>${esc(t('seeAlso'))}</span></h2><div class="cp-box-body"><button class="cp-link" type="button" data-topic="keys"><img src="assets/images/help/topic.png" alt=""><span>${esc(t('seeKeys'))}</span></button><button class="cp-link" type="button" data-topic="trouble"><img src="assets/images/help/topic.png" alt=""><span>${esc(t('seeTrouble'))}</span></button><button class="cp-link" type="button" data-link="github"><img src="assets/images/help/topic.png" alt=""><span>${esc(t('seeGithub'))}</span></button></div></section>`;
}
function remember(id) { const list = stored('nk_help_history', []).filter(item => item !== id); list.unshift(id); save('nk_help_history', list.slice(0, 30)); }
// Home, like XP's: no task pane; "Pick a Help topic" in groups with big icons, then "Ask for
// assistance", "Pick a task" and "Did you know?" on the right.
const HOME_GROUPS = [['users-48', ['start', 'privacy', 'backups']], ['network-48', ['chats', 'calls', 'assistant']], ['appearance-48', ['control', 'catalog']], ['performance-48', ['keys', 'trouble']]];
const TIPS = {
  ru: ['Ctrl+K открывает любой чат по названию.', 'Щёлкните помощника, чтобы найти сообщения во всех чатах сразу.', 'Шапку чата можно вытащить мышью — чат откроется в своём окне.', 'Правой кнопкой по чату можно выбрать для него свой звук уведомлений.', 'В теме Classic есть 22 классические цветовые схемы Windows XP.', 'Вызовите друга на «Сапёра» правой кнопкой по чату.'],
  en: ['Ctrl+K opens any chat by its name.', 'Click the assistant to search messages in all chats at once.', 'Drag the chat header out to open the chat in its own window.', 'Right-click a chat to give it its own notification sound.', 'The Classic theme has the 22 classic colour schemes of Windows XP.', 'Challenge a friend to Minesweeper from a chat\'s right-click menu.'],
};
const searchOptions = () => ({ highlight: true, titleOnly: false, ...stored('nk_help_search', {}) });
let lastResults = null; // { query, suggested: [ids], topics: [ids] } shown in the pane while you read them
function resultsPane(results) {
  const list = (ids, key) => `<div class="help-results-group"><h3>${esc(t(key))} (${ids.length})</h3>${ids.length ? `<ol>${ids.map(id => `<li><a href="#" data-topic="${id}">${esc(topicById(id)?.title || id)}</a></li>`).join('')}</ol>` : ''}</div>`;
  return `<section class="cp-box help-box help-results"><h2><span>${esc(t('results'))}</span><small>${esc(t('tipsLink'))}</small></h2><div class="cp-box-body">${list(results.suggested, 'suggested')}${list(results.topics, 'helpTopics')}</div></section>`;
}
function optionsPane() {
  return `<section class="cp-box help-box"><h2><span>${esc(t('optionsTitle'))}</span></h2><div class="cp-box-body"><button class="cp-link" type="button" data-page="options-center"><img src="assets/images/help/topic.png" alt=""><span>${esc(t('optionsCenter'))}</span></button><button class="cp-link" type="button" data-page="options-search"><img src="assets/images/help/topic.png" alt=""><span>${esc(t('optionsSearch'))}</span></button></div></section>`;
}
function highlight(html, query) {
  if (!query || !searchOptions().highlight) return html;
  const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return html.split(/(<[^>]+>)/).map(part => part.startsWith('<') ? part : part.replace(pattern, '<mark>$1</mark>')).join('');
}
function render() {
  const pageNode = $('#hc-page'); const [kind, ...rest] = page.split(':'); const arg = rest.join(':');
  const center = document.querySelector('.help-center');
  center.classList.toggle('help-home-view', kind === 'home' || !kind);
  pageNode.className = 'help-page';
  if (kind === 'topic' && topicById(arg)?.children) open.add(arg);
  if (kind === 'topic' && topicById(arg)?.parent) open.add(topicById(arg).parent);
  const fromSearch = kind === 'topic' && lastResults && [...lastResults.suggested, ...lastResults.topics].includes(arg);
  $('#hc-pane').innerHTML = kind === 'search' ? '' : fromSearch ? resultsPane(lastResults) : kind.startsWith('options') ? optionsPane() : tree(kind === 'topic' ? arg : '');
  if (kind === 'topic' && topicById(arg)) {
    const topic = topicById(arg); remember(topic.id);
    // A topic with sub-topics is an overview on blue; a topic itself is a white page.
    if (!topic.children) pageNode.classList.add('help-white');
    pageNode.innerHTML = `${topic.children ? '' : '<img class="help-logo" src="assets/images/nekochat_icon.png" alt="">'}<h1>${esc(topic.title)}</h1>${highlight(topic.text, fromSearch ? lastResults.query : '')}${topic.children ? `<ul class="help-links">${topic.children.map(child => `<li><a href="#" data-topic="${child.id}">${esc(child.title)}</a></li>`).join('')}</ul>` : ''}`;
  } else if (kind === 'search') {
    const needle = arg.toLowerCase(); const { titleOnly } = searchOptions();
    const inTitle = topic => topic.title.toLowerCase().includes(needle) || (topic.keys || []).some(key => key.toLowerCase().includes(needle));
    const inText = topic => topic.text.replace(/<[^>]+>/g, ' ').toLowerCase().includes(needle);
    const suggested = flat().filter(inTitle).map(topic => topic.id);
    const topics = titleOnly ? [] : flat().filter(topic => !suggested.includes(topic.id) && inText(topic)).map(topic => topic.id);
    lastResults = { query: arg, suggested, topics };
    $('#hc-pane').innerHTML = resultsPane(lastResults);
    pageNode.innerHTML = `<h1>${esc(t('browseTitle'))}</h1><p>${esc(t('browse1'))}</p><p>${esc(t('browse2'))}</p><p>${esc(t('browse3'))}</p><p>${esc(t('browse4'))} <a href="#" data-page="index">${esc(t('index'))}</a>.</p>`;
  } else if (kind === 'index') {
    const entries = flat().flatMap(topic => (topic.keys || []).map(key => [key, topic])).sort((a, b) => a[0].localeCompare(b[0], language));
    pageNode.innerHTML = `<h1>${esc(t('indexTitle'))}</h1><p>${esc(t('indexHint'))}</p><input class="help-index-filter" type="search" id="hc-index-filter"><ul class="help-index">${entries.map(([key, topic]) => `<li data-key="${esc(key)}"><a href="#" data-topic="${topic.id}">${esc(key)}</a> <small>— ${esc(topic.title)}</small></li>`).join('')}</ul>`;
    const filter = $('#hc-index-filter'); filter.oninput = () => pageNode.querySelectorAll('.help-index li').forEach(li => { li.hidden = !li.dataset.key.toLowerCase().startsWith(filter.value.toLowerCase()); }); filter.focus();
  } else if (kind === 'favorites' || kind === 'history') {
    const list = stored(kind === 'favorites' ? 'nk_help_favorites' : 'nk_help_history', []).map(topicById).filter(Boolean);
    pageNode.innerHTML = `<h1>${esc(t(kind === 'favorites' ? 'favoritesTitle' : 'historyTitle'))}</h1>${list.length ? `<ul class="help-links">${list.map(topic => `<li><a href="#" data-topic="${topic.id}">${esc(topic.title)}</a>${kind === 'favorites' ? ` <button type="button" class="help-remove" data-remove="${topic.id}">${esc(t('remove'))}</button>` : ''}</li>`).join('')}</ul>` : `<p>${esc(t(kind === 'favorites' ? 'favoritesEmpty' : 'historyEmpty'))}</p>`}`;
  } else if (kind === 'options') {
    pageNode.innerHTML = `<h1>${esc(t('optionsTitle'))}</h1><p>${esc(t('options1'))}</p><p>${esc(t('options2'))}</p><p>${esc(t('options3'))}</p>`;
  } else if (kind === 'options-center') {
    pageNode.classList.add('help-white');
    pageNode.innerHTML = `<h1>${esc(t('optionsCenter'))}</h1><p>${esc(t('optionsText'))}</p><p><a href="#" data-link="control">${esc(t('taskControl'))}</a></p>`;
  } else if (kind === 'options-search') {
    const options = searchOptions(); pageNode.classList.add('help-white');
    pageNode.innerHTML = `<h1>${esc(t('optionsSearch'))}</h1><p>${esc(t('optionsSearchText'))}</p><label class="help-check"><input type="checkbox" id="hc-opt-highlight"${options.highlight ? ' checked' : ''}> ${esc(t('optHighlight'))}</label><label class="help-check"><input type="checkbox" id="hc-opt-title"${options.titleOnly ? ' checked' : ''}> ${esc(t('optTitle'))}</label>`;
    pageNode.querySelectorAll('input').forEach(input => { input.onchange = () => save('nk_help_search', { highlight: $('#hc-opt-highlight').checked, titleOnly: $('#hc-opt-title').checked }); });
  } else {
    page = 'home';
    const tips = TIPS[language].filter(text => window.nkHasAssistants?.() || !/assistant|помощник/i.test(text)); const tip = tips[Math.floor(Math.random() * tips.length)];
    pageNode.innerHTML = `<div class="help-home"><div><h1>${esc(t('pickTopic'))}</h1>${HOME_GROUPS.map(([icon, ids]) => `<div class="help-home-group"><img src="${cpIcon(icon)}" alt=""><ul>${ids.map(id => `<li><a href="#" data-topic="${id}">${esc(topicById(id)?.title || id)}</a></li>`).join('')}</ul></div>`).join('')}</div>`
      + `<div><h1>${esc(t('askTitle'))}</h1><ul class="help-home-tasks"><li><img src="assets/images/control-panel/task-bullet.png" alt=""><a href="#" data-link="bug">${t('askBug')}</a></li><li><img src="assets/images/control-panel/task-bullet.png" alt=""><a href="#" data-link="github">${t('askProject')}</a></li></ul>`
      + `<h1>${esc(t('tasks'))}</h1><ul class="help-home-tasks"><li><img src="assets/images/control-panel/task-bullet.png" alt=""><a href="#" data-link="updates">${t('taskUpdates2')}</a></li><li><img src="assets/images/control-panel/task-bullet.png" alt=""><a href="#" data-link="control">${t('taskControl2')}</a></li><li><img src="assets/images/control-panel/task-bullet.png" alt=""><a href="#" data-link="catalog">${t('taskCatalog2')}</a></li><li><img src="assets/images/control-panel/task-bullet.png" alt=""><a href="#" data-link="backup">${t('taskBackup')}</a></li></ul>`
      + `<h1>${esc(t('didYouKnow'))}</h1><p class="help-tip">${esc(tip)}</p></div></div>`;
  }
  $('#hc-back').disabled = !back.length; $('#hc-forward').disabled = !forward.length;
  $('#hc-add-favorite').disabled = kind !== 'topic'; $('#hc-locate').disabled = kind !== 'topic'; $('#hc-print').disabled = kind !== 'topic';
}
const LINKS = {
  github: () => window.open('https://github.com/xKaMikax/nekochat_reloaded', '_blank', 'noopener'),
  bug: () => window.open('https://github.com/xKaMikax/nekochat_reloaded/issues', '_blank', 'noopener'),
  updates: () => { try { localStorage.setItem('nk_update_check', String(Date.now())); } catch {} },
  control: () => controls.openControlPanel?.(),
  catalog: () => controls.openThemeBrowser?.(),
  backup: () => (controls.openApplet ? controls.openApplet('backups') : controls.openThemeSettings?.()),
};
document.addEventListener('click', event => {
  const toggle = event.target.closest('[data-toggle]');
  if (toggle) { event.stopPropagation(); const id = toggle.dataset.toggle; if (open.has(id)) open.delete(id); else open.add(id); render(); return; }
  const remove = event.target.closest('[data-remove]');
  if (remove) { save('nk_help_favorites', stored('nk_help_favorites', []).filter(id => id !== remove.dataset.remove)); render(); return; }
  const topic = event.target.closest('[data-topic]'); if (topic) { event.preventDefault(); go(`topic:${topic.dataset.topic}`); return; }
  const link = event.target.closest('[data-link]'); if (link) { event.preventDefault(); LINKS[link.dataset.link]?.(); return; }
  const target = event.target.closest('[data-page]'); if (target) { event.preventDefault(); go(target.dataset.page); return; }
  const header = event.target.closest('.cp-box h2'); if (header) header.parentElement.classList.toggle('collapsed');
});
$('#hc-back').onclick = () => step(back, forward);
$('#hc-forward').onclick = () => step(forward, back);
$('#hc-home').onclick = () => go('home');
$('#hc-index').onclick = () => go('index');
$('#hc-favorites').onclick = () => go('favorites');
$('#hc-history').onclick = () => go('history');
$('#hc-support').onclick = () => LINKS.bug();
$('#hc-options').onclick = () => go('options');
$('#hc-search').onsubmit = event => { event.preventDefault(); const query = $('#hc-query').value.trim(); if (query) go(`search:${query}`); };
$('#hc-add-favorite').onclick = () => { const id = page.split(':')[1]; if (!id) return; const list = stored('nk_help_favorites', []).filter(item => item !== id); list.unshift(id); save('nk_help_favorites', list); window.nkPlaySound?.('default'); };
$('#hc-view').onclick = () => document.querySelector('.help-center').classList.toggle('help-pane-hidden');
$('#hc-print').onclick = () => window.print();
$('#hc-locate').onclick = () => { document.querySelector('.help-center').classList.remove('help-pane-hidden'); lastResults = null; render(); document.querySelector('.help-node.selected')?.scrollIntoView({ block: 'center' }); };
document.addEventListener('keydown', event => { if (event.altKey && event.key === 'ArrowLeft') step(back, forward); if (event.altKey && event.key === 'ArrowRight') step(forward, back); });
controls.onHelpTopic?.(topic => go(`topic:${topic}`));
$('#close').onclick = () => controls.close();

function applyText() {
  document.documentElement.lang = language; document.title = t('title'); $('.xp-title').textContent = t('title');
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  $('#close').setAttribute('aria-label', t('close'));
  $('#hc-version').textContent = `Nekochat Reloaded ${window.NEKOCHAT_RELOADED_VERSION || ''}`;
  render();
}
const checkClassic = () => document.documentElement.classList.toggle('cp-classic-look', getComputedStyle(document.documentElement).getPropertyValue('--classic-raised').trim() !== '');
$('#frame-theme').addEventListener('load', checkClassic);
function applyFrame(theme) { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; requestAnimationFrame(checkClassic); }
controls.getActiveTheme().then(applyFrame); controls.onThemeChanged(applyFrame);
controls.onDisplayChanged(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
controls.getDisplaySettings().then(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
applyText();
