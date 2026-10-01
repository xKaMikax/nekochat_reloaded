// Russian for the Control Panel applets (Display, Mouse, Sounds, Regional, Network, Automatic Updates, Backup,
// User Accounts privacy, Assistant). Their texts are written in English, like Windows XP's; with the
// Russian interface this script replaces every known text (text nodes and placeholder/title/aria-label)
// by its Russian one, also for what the page adds later, and puts the English back when the language
// is English. A text that is not in the table stays as it is.
(() => {
  const RU = {
    // windows and tabs
    'Display Properties': 'Свойства: Экран', 'Mouse Properties': 'Свойства: Мышь', 'Sounds and Audio Devices Properties': 'Свойства: Звуки и аудиоустройства',
    'Regional and Language Options': 'Язык и региональные стандарты', 'Network Connections': 'Сетевые подключения', 'Automatic Updates': 'Автоматическое обновление',
    'Backup': 'Резервное копирование', 'User Accounts': 'Учётные записи пользователей', 'Privacy': 'Конфиденциальность', 'Assistant': 'Помощник',
    'Close': 'Закрыть', 'Themes': 'Темы', 'Desktop': 'Рабочий стол', 'Appearance': 'Оформление', 'Display': 'Экран', 'Sounds': 'Звуки', 'Settings': 'Параметры', 'Backups': 'Резервные копии',
    'Pointers': 'Указатели', 'Audio': 'Аудио', 'Regional Options': 'Региональные параметры', 'Languages': 'Языки', 'Nekochat Reloaded': 'Nekochat Reloaded',
    'OK': 'ОК', 'Cancel': 'Отмена', 'Apply': 'Применить',
    // themes, desktop, appearance
    'A theme is a background plus a set of window colours and controls.': 'Тема — это фон плюс набор цветов окон и элементов управления.',
    'Theme:': 'Тема:', 'Theme preview': 'Образец темы', 'Add Theme…': 'Добавить тему…', 'Chat background:': 'Фон чата:', '(None)': '(Нет)', 'Bliss': 'Bliss', 'Windows XP logon': 'Вход в Windows XP',
    'Picture…': 'Рисунок…', 'Browse...': 'Обзор...', 'Position:': 'Расположение:', 'Stretch': 'Растянуть', 'Center': 'По центру', 'Tile': 'Мозаика', 'Color:': 'Цвет:', 'None': 'Нет', 'Visibility:': 'Видимость:',
    'Appearance preview': 'Образец оформления', 'Windows and buttons:': 'Окна и кнопки:', 'Windows XP style': 'Стиль Windows XP', 'Windows style': 'Стиль Windows', 'Colour scheme:': 'Цветовая схема:', 'Font size:': 'Размер шрифта:',
    'Normal': 'Обычный', 'Large Fonts': 'Крупный', 'Extra Large Fonts': 'Огромный', 'Effects…': 'Эффекты…', 'Advanced': 'Дополнительно', 'Default': 'По умолчанию',
    'Importing theme…': 'Импорт темы…', 'Theme added. Click Apply to use it.': 'Тема добавлена. Нажмите «Применить», чтобы использовать её.', 'The picture is too large.': 'Рисунок слишком большой.',
    'The Nekochat Reloaded server address must start with http:// or https://': 'Адрес сервера Nekochat Reloaded должен начинаться с http:// или https://',
    // colour schemes
    'Windows Standard': 'Стандартная Windows', 'High Contrast #1': 'Высокий контраст № 1', 'High Contrast #2': 'Высокий контраст № 2', 'High Contrast Black': 'Высокий контраст, чёрный', 'High Contrast White': 'Высокий контраст, белый',
    'Marine (high color)': 'Морская (High Color)', 'Plum (high color)': 'Слива (High Color)', 'Pumpkin (large)': 'Тыква (крупная)', 'Rainy Day': 'Дождливый день', 'Red, White, and Blue (VGA)': 'Красный, белый и синий (VGA)',
    'Storm (VGA)': 'Гроза (VGA)', 'Teal (VGA)': 'Сине-зелёная (VGA)', 'Brick': 'Кирпич', 'Desert': 'Пустыня', 'Eggplant': 'Баклажан', 'Lilac': 'Сирень', 'Maple': 'Клён', 'Marine': 'Морская', 'Plum': 'Слива', 'Pumpkin': 'Тыква',
    'Rose': 'Роза', 'Slate': 'Сланец', 'Spruce': 'Ель', 'Wheat': 'Пшеница', 'Windows Classic': 'Windows Classic',
    // effects and advanced appearance
    'Effects': 'Эффекты', 'Use the following transition effect for menus and tooltips:': 'Применять следующий эффект перехода для меню и подсказок:', 'Fade effect': 'Плавное затухание', 'Scroll effect': 'Прокрутка',
    'Use the following method to smooth edges of screen fonts:': 'Применять следующий метод сглаживания краёв экранных шрифтов:', 'Standard': 'Обычный', 'ClearType': 'ClearType', 'Use large icons': 'Крупные значки', 'Show shadows under menus': 'Отображать тень от меню',
    'Advanced Appearance': 'Дополнительное оформление', 'If you select a windows and buttons setting other than Windows Classic, it will override the following settings, except in some older programs.': 'Если выбрать для окон и кнопок стиль, отличный от Windows Classic, он заменит следующие параметры (кроме некоторых старых программ).',
    'Item:': 'Элемент:', 'Size:': 'Размер:', 'Color 1:': 'Цвет 1:', 'Color 2:': 'Цвет 2:', 'Font color:': 'Цвет шрифта:', 'Use default': 'По умолчанию', 'Preview': 'Образец',
    'Active Title Bar': 'Активное окно (заголовок)', 'Inactive Title Bar': 'Неактивное окно (заголовок)', 'Window': 'Окно', 'Selected Items': 'Выделенные элементы', '3D Objects': 'Объёмные элементы', 'Message Text': 'Текст сообщения', 'ToolTip': 'Подсказка',
    'Active Window': 'Активное окно', 'Window Text': 'Текст в окне',
    // language, sounds, mouse
    'Display settings': 'Параметры отображения', 'Language:': 'Язык:', 'Logon screen:': 'Экран входа:', 'Classic style': 'Классический стиль', 'Cursors:': 'Курсоры:', 'Windows XP (default)': 'Windows XP (по умолчанию)', 'System': 'Системные',
    'Icons:': 'Значки:', 'Nekochat Reloaded (default)': 'Nekochat Reloaded (по умолчанию)', 'Changes are saved when you click Apply.': 'Изменения сохраняются при нажатии «Применить».',
    'Sound scheme:': 'Звуковая схема:', 'No sounds': 'Без звуков', 'Volume:': 'Громкость:', 'Microphone:': 'Микрофон:', 'Noise suppression:': 'Шумоподавление:', 'Standard (WebRTC)': 'Стандартное (WebRTC)', 'RNNoise (neural network)': 'RNNoise (нейросеть)', 'Off': 'Выключено',
    'Scheme': 'Схема', 'Save As...': 'Сохранить как...', 'Customize:': 'Настройка:', 'Normal Select': 'Основной режим', 'Help Select': 'Справка', 'Working In Background': 'Фоновый режим', 'Busy': 'Занят', 'Precision Select': 'Точное выделение',
    'Text Select': 'Выделение текста', 'Unavailable': 'Недоступно', 'Vertical Resize': 'Вертикальное изменение размеров', 'Horizontal Resize': 'Горизонтальное изменение размеров', 'Diagonal Resize 1': 'Диагональное изменение размеров 1',
    'Diagonal Resize 2': 'Диагональное изменение размеров 2', 'Move': 'Перемещение', 'Link Select': 'Выбор ссылки', 'Use Default': 'По умолчанию',
    // regional
    'Standards and formats': 'Стандарты и форматы', 'This option affects the language of the menus, windows and help of Nekochat Reloaded.': 'Этот параметр определяет язык меню, окон и справки Nekochat Reloaded.',
    // network
    'Use the Nekochat Reloaded server': 'Использовать сервер Nekochat Reloaded', 'Nekochat Reloaded server:': 'Сервер Nekochat Reloaded:', 'Screen sharing codec:': 'Кодек демонстрации экрана:', 'Automatic (VP9)': 'Автоматически (VP9)',
    'Send calls over the binary media socket (/ws/media) when the server has it': 'Передавать звонки по бинарному медиа-сокету (/ws/media), если он есть на сервере', 'DNS:': 'DNS:', 'System default': 'Системный', 'Custom DNS-over-HTTPS…': 'Свой DNS-over-HTTPS…', 'DoH address:': 'Адрес DoH:',
    // privacy and updates
    'Show others when I was last online': 'Показывать другим, когда я был(а) в сети', 'Set me to Away after:': 'Ставить статус «Отошёл» через:', 'Never': 'Никогда', '5 minutes': '5 минут', '10 minutes': '10 минут', '15 minutes': '15 минут', '30 minutes': '30 минут', '1 hour': '1 час',
    'Show the “Server admin panel” button': 'Показывать кнопку «Панель администратора сервера»', 'Updates:': 'Обновления:', 'Check for updates automatically': 'Проверять обновления автоматически', 'Offer beta versions': 'Предлагать бета-версии', 'Check now': 'Проверить сейчас',
    'Help keep Nekochat Reloaded up to date': 'Поддерживайте Nekochat Reloaded в актуальном состоянии', 'Nekochat Reloaded can regularly check for new versions and install them for you.': 'Nekochat Reloaded может регулярно проверять наличие новых версий и устанавливать их.',
    'What\'s new in Nekochat Reloaded?': 'Что нового в Nekochat Reloaded?', 'Automatic (recommended)': 'Автоматически (рекомендуется)', 'Automatically download new versions and install them when Nekochat Reloaded closes.': 'Автоматически загружать новые версии и устанавливать их при закрытии Nekochat Reloaded.',
    'Download updates for me, but let me choose when to install them.': 'Загружать обновления, но разрешить мне выбирать время установки.', 'Notify me but don\'t automatically download or install them.': 'Уведомлять, но не загружать и не устанавливать автоматически.',
    'Turn off Automatic Updates.': 'Отключить автоматическое обновление.', 'Nekochat Reloaded will look for new versions only when you click Check now. Install them from the': 'Nekochat Reloaded будет искать новые версии, только когда вы нажмёте «Проверить сейчас». Установите их со страницы', 'releases page': 'выпусков',
    // backups
    'A backup keeps your settings, themes, pictures and account list on the Nekochat Reloaded server. Sign-in passwords and sessions are never included.': 'Резервная копия хранит ваши параметры, темы, рисунки и список учётных записей на сервере Nekochat Reloaded. Пароли и сеансы входа в неё не попадают.',
    'Backup name': 'Имя копии', 'Back up my settings': 'Сделать копию параметров', 'Include': 'Включить', 'Name': 'Имя', 'Created': 'Создана', 'Client': 'Клиент', 'Size': 'Размер', 'Restore': 'Восстановить', 'Restore selected': 'Восстановить выбранную',
    'Restore…': 'Восстановить…', 'Delete': 'Удалить', 'Refresh': 'Обновить', 'Muted chats': 'Чаты без уведомлений',
    'installed themes, cursor, sound and icon packs, and the chosen theme': 'установленные темы, пакеты курсоров, звуков и значков и выбранная тема', 'language, logon screen, chat background and its picture': 'язык, экран входа, фон чата и его рисунок',
    'sound scheme and volume': 'звуковая схема и громкость', 'microphone, noise suppression, servers, screen codec, DNS': 'микрофон, шумоподавление, серверы, кодек экрана, DNS', 'the account list on the sign-in screen (you sign in again)': 'список учётных записей на экране входа (войти придётся заново)',
    'chats with notifications turned off': 'чаты с выключенными уведомлениями',
    // assistant
    'The assistant sits in the chat window. Click him to search all your chats, see unread chats, change your status or get a tip.': 'Помощник живёт в окне чата. Щёлкните по нему, чтобы искать по всем чатам, смотреть непрочитанные, менять статус или получать советы.',
    'Character:': 'Персонаж:',
  };
  let language = 'ru';
  const state = new WeakMap();         // text node -> { orig, set }
  const attrState = new WeakMap();     // element -> { attr: { orig, set } }
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const key = text => String(text || '').replace(/\s+/g, ' ').trim();
  function text(node) {
    const record = state.get(node), current = node.nodeValue;
    if (record && current !== record.set) { record.orig = current; record.set = null; }          // the page wrote a new text
    const orig = record ? record.orig : current, translated = RU[key(orig)];
    if (language === 'ru' && translated) {
      const next = (orig.match(/^\s*/)[0]) + translated + (orig.match(/\s*$/)[0]);
      if (current !== next) node.nodeValue = next;
      state.set(node, { orig, set: next });
    } else if (record) { if (record.set !== null && current === record.set) node.nodeValue = orig; state.delete(node); }
  }
  function attrs(element) {
    for (const name of ATTRS) {
      if (!element.hasAttribute?.(name)) continue;
      const store = attrState.get(element) || {}; const record = store[name], current = element.getAttribute(name);
      if (record && current !== record.set) { record.orig = current; record.set = null; }
      const orig = record ? record.orig : current, translated = RU[key(orig)];
      if (language === 'ru' && translated) { if (current !== translated) element.setAttribute(name, translated); store[name] = { orig, set: translated }; attrState.set(element, store); }
      else if (record) { if (record.set !== null && current === record.set) element.setAttribute(name, orig); delete store[name]; }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { text(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    const start = root.nodeType === 9 ? root.documentElement : root;
    if (start.tagName === 'SCRIPT' || start.tagName === 'STYLE') return;
    attrs(start);
    const tree = document.createTreeWalker(start, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: node => (node.nodeType === 1 && (node.tagName === 'SCRIPT' || node.tagName === 'STYLE')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let node;
    while ((node = tree.nextNode())) { if (node.nodeType === 3) text(node); else attrs(node); }
  }
  const observer = new MutationObserver(records => {
    observer.disconnect();
    for (const record of records) {
      if (record.type === 'characterData') text(record.target);
      else if (record.type === 'attributes') attrs(record.target);
      else for (const node of record.addedNodes) walk(node);
    }
    observe();
  });
  const observe = () => observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  function apply(next) {
    language = next === 'en' ? 'en' : 'ru';
    observer.disconnect(); walk(document); observe();
    document.documentElement.lang = language;
  }
  const controls = window.windowControls || window.parent?.windowControls;
  controls?.getDisplaySettings?.().then(settings => apply(settings?.language));
  controls?.onDisplayChanged?.(settings => apply(settings?.language));
})();
