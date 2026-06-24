<div align="center">

# 🎵 Discord Lyrics Status

**Sync Spotify lyrics in real-time to your Discord custom status**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows-blue)](https://github.com/MMahesa/discord-lyrics)
[![GitHub](https://img.shields.io/badge/GitHub-MMahesa-black?logo=github)](https://github.com/MMahesa/discord-lyrics)

</div>

---

## ✨ Features

- 🎵 **Real-time lyrics** — displayed line by line in sync with the current song position
- 💬 **Automatic Discord status** — lyrics appear directly in your custom status
- 🌐 **Web Dashboard** — visual display in your browser at `http://localhost:3000`
- 🖥️ **Terminal UI** — box display with progress bar rendered directly in the terminal
- 🎛️ **Startup mode menu** — choose between Terminal, Dashboard, or both on launch
- 🎨 **Album art + genre** — metadata fetched via iTunes API (no API key required)
- ⚡ **Rate-limit aware** — automatically respects Discord API rate limits
- 🔄 **Lyrics cache** — minimizes repeated requests to lrclib.net

---

## 📋 Prerequisites

| Requirement | Version |
|-------------|---------|
| OS | **Windows 10/11** (uses SMTC to read Spotify) |
| Node.js | **v18+** |
| Spotify | Desktop app actively playing music |
| Discord | Active account with a valid user token |

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/MMahesa/discord-lyrics.git
cd discord-lyrics
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure `.env`

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_USER_TOKEN=your_discord_token_here
POLL_INTERVAL_MS=800
WEB_PORT=3000
```

### 4. Run

```bash
npm start
```

On startup, you will see a **mode selection menu**:

```
  Select display mode:
  ❯ Terminal + Dashboard (both)
    Terminal only
    Dashboard only (opens browser automatically)
```

---

## 🔑 How to Get Your Discord Token

> ⚠️ **Warning:** Your Discord User Token is **highly sensitive**. Never share it with anyone or commit it to version control. This token grants full access to your account.

1. Open **Discord** in your web browser (not the desktop app)
2. Press `F12` to open DevTools → go to the **Network** tab
3. Filter requests by `api`
4. Click any request to `discord.com/api`
5. Open the **Headers** tab → look for `Authorization`
6. Copy that value into `DISCORD_USER_TOKEN` in your `.env` file

---

## 🎛️ Display Modes

When you run `npm start`, you will be prompted to select a display mode:

| Mode | Description |
|------|-------------|
| **Terminal + Dashboard** | Terminal UI and web dashboard open simultaneously |
| **Terminal only** | Box UI in the terminal only; web server is not started |
| **Dashboard only** | Web server starts, browser opens automatically, minimal terminal output |

You can also set the mode permanently in `.env`:

```env
RUN_MODE=both        # Terminal + Dashboard
RUN_MODE=terminal    # Terminal only
RUN_MODE=dashboard   # Dashboard only
```

---

## 📁 Project Structure

```
discord-lyrics/
├── src/
│   ├── index.js       # Entry point, main loop, and CLI menu
│   ├── spotify.js     # Reads active media via Windows SMTC (PowerShell)
│   ├── lyrics.js      # Fetches and parses synced lyrics from lrclib.net
│   ├── status.js      # Updates Discord custom status via API
│   ├── dashboard.js   # Renders terminal UI (chalk box display)
│   ├── musicmeta.js   # Fetches track metadata via iTunes API
│   └── webserver.js   # Express server, SSE endpoint, and web dashboard HTML
├── .env               # Local configuration (not committed to git)
├── .env.example       # Configuration template
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

---

## ⚙️ Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_USER_TOKEN` | *(required)* | Your Discord account token |
| `POLL_INTERVAL_MS` | `800` | How often to poll Spotify, in milliseconds |
| `WEB_PORT` | `3000` | Port for the web dashboard |
| `RUN_MODE` | *(prompted on start)* | `terminal`, `dashboard`, or `both` |
| `DEBUG_POSITION` | `0` | Set to `1` to enable lyric position debug logging |

---

## 🛠️ Troubleshooting

**Status not updating on Discord?**
- Make sure `DISCORD_USER_TOKEN` is correct and up to date
- Verify Spotify is actively playing (not paused)

**Lyrics not showing?**
- Not every track is available in the lrclib.net database
- Try a more popular song to confirm the feature is working

**Dashboard not opening?**
- Open it manually at `http://localhost:3000`
- Make sure port `3000` is not in use by another application (change `WEB_PORT` if needed)

**PowerShell error?**
- Make sure you are running Windows 10 or 11
- Run as a regular user (not Administrator)

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `axios` | ^1.7.7 | HTTP requests (Discord API, lyrics, metadata) |
| `chalk` | ^5.3.0 | Terminal colors |
| `dotenv` | ^16.4.5 | Load variables from `.env` |
| `express` | ^4.19.2 | Web dashboard server |

---

## ⚠️ Disclaimer

This project uses a **Discord User Token** (not a Bot Token) to update your custom status. Automating actions with a user token violates [Discord's Terms of Service](https://discord.com/terms). Use at your own risk. This project was built purely for personal use and educational purposes.

---

## 📄 License

Distributed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made by [mmahesa](https://github.com/MMahesa)

</div>
