# NekoChat Reloaded — PC client

![NekoChat Reloaded desktop client](https://raw.githubusercontent.com/xKaMikax/nekochat_reloaded/pc/screenshots/nekochat-pc.png)

> **Warning:** this is a custom NekoChat client, not the official one. The official client is here: https://github.com/xKaMikax/nekochat2linux

## What the client includes

- Rooms and direct messages.
- Detached chat windows and voice calls.
- Windows XP-inspired themes.
- XP-style notification, login, and call sounds.

## Run on PC

Install Node.js 20+ and npm, then run these commands from the repository root:

```bash
git clone --branch pc git@github.com:xKaMikax/nekochat_reloaded.git
cd nekochat_reloaded
npm install
npm start
```

## Build for Linux

```bash
npm run build:linux
```

The AppImage and `.deb` files will be created in `release/`.

## Build for Windows

```bash
npm run build:windows
```

The NSIS installer and portable build will be created in `release/`.
