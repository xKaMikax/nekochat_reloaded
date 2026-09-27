# NekoChat Reloaded

<img src="screenshots/nekochat-pc.png" alt="NekoChat Reloaded PC client" height="480"> <img src="screenshots/nekochat-android.png" alt="NekoChat Reloaded Android client" height="480"> <img src="screenshots/nekochat-iphone.png" alt="NekoChat Reloaded iPhone client" height="480">

*iPhone screenshot by [VASHYAN-CMD](https://github.com/VASHYAN-CMD).*

> **Warning:** this is a custom NekoChat client, not the official one. The official client is here: https://github.com/xKaMikax/nekochat2linux

## Web version

Open **https://xkamikax.github.io/nekochat_reloaded/** in a browser — no installation needed. The web version is the same client as on PC, Android and iPhone: XP windows, themes (including the online catalog and imported `.msstyles`, `.theme`, `theme.css` and `.zip` files), calls, screen sharing and notifications.

It can also be installed as an app (PWA): in Chrome or Edge click **Install** in the address bar; on Android choose **Add to Home screen**; on iPhone open it in Safari and choose **Share → Add to Home Screen**.

Browser limits: screen sharing and calls need Chrome or Edge (WebCodecs); the DNS choice and the tray are PC-only; notifications arrive while the page is open.

## What the client includes

- Rooms and direct messages.
- Detached chat windows and voice calls with screen sharing and noise suppression.
- Windows XP-inspired themes and an online theme catalog.
- XP-style notification, login, and call sounds.

## Branches

The source code lives in separate branches:

| Branch | Client |
|---|---|
| [`pc`](https://github.com/xKaMikax/nekochat_reloaded/tree/pc) | PC client for Linux and Windows (Electron) |
| [`android`](https://github.com/xKaMikax/nekochat_reloaded/tree/android) | Android client |
| [`iphone`](https://github.com/xKaMikax/nekochat_reloaded/tree/iphone) | iPhone client |
| [`main`](https://github.com/xKaMikax/nekochat_reloaded/tree/main) | Web version (PWA), published with GitHub Pages |

To get the PC client:

```bash
git clone --branch pc git@github.com:xKaMikax/nekochat_reloaded.git
```

To get the Android client:

```bash
git clone --branch android git@github.com:xKaMikax/nekochat_reloaded.git
```

To get the iPhone client:

```bash
git clone --branch iphone git@github.com:xKaMikax/nekochat_reloaded.git
```
