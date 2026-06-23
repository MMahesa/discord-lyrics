import "dotenv/config";
import readline from "readline";
import { getCurrentTrack } from "./spotify.js";
import { getSyncedLyrics, findCurrentLine } from "./lyrics.js";
import { setStatus, clearStatus } from "./status.js";
import { printStartupBanner, renderIdle, renderNowPlaying } from "./dashboard.js";
import { getTrackMeta } from "./musicmeta.js";
import { startWebServer, broadcastState } from "./webserver.js";

const TOKEN         = process.env.DISCORD_USER_TOKEN;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "800", 10);
const WEB_PORT      = parseInt(process.env.WEB_PORT || "3000", 10);
const DEBUG         = process.env.DEBUG_POSITION === "1";

if (!TOKEN) {
  console.error("DISCORD_USER_TOKEN belum diisi di file .env. Lihat README.");
  process.exit(1);
}

// ── Mode constants ────────────────────────────────────────────────────────────
const MODE = {
  BOTH:      "both",
  TERMINAL:  "terminal",
  DASHBOARD: "dashboard",
};

// ── CLI Menu ──────────────────────────────────────────────────────────────────
const MENU_OPTIONS = [
  { label: "Terminal + Dashboard (keduanya)", value: MODE.BOTH },
  { label: "Terminal saja",                   value: MODE.TERMINAL },
  { label: "Dashboard saja (buka browser)",   value: MODE.DASHBOARD },
];

function promptMode() {
  return new Promise((resolve) => {
    const envMode = process.env.RUN_MODE?.toLowerCase();
    if (envMode && Object.values(MODE).includes(envMode)) {
      console.log(`\n▶  Mode dari .env: ${envMode}\n`);
      resolve(envMode);
      return;
    }

    let selected = 0;

    const rl = readline.createInterface({
      input:  process.stdin,
      output: process.stdout,
    });

    // Enable raw mode 
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    function render() {
      if (render.lines) {
        process.stdout.write(`\x1b[${render.lines}A\x1b[0J`);
      }
      const lines = ["\n  Pilih mode tampilan:\n"];
      MENU_OPTIONS.forEach((opt, i) => {
        const cursor = i === selected ? "  \u276f " : "    ";
        const text   = i === selected
          ? `\x1b[1;36m${opt.label}\x1b[0m`
          : `\x1b[90m${opt.label}\x1b[0m`;
        lines.push(`${cursor}${text}`);
      });
      lines.push("\n  \x1b[90m\u2191\u2193 navigasi  \u2022  Enter konfirmasi\x1b[0m\n");
      process.stdout.write(lines.join("\n"));
      render.lines = lines.length;
    }

    render.lines = 0;
    render();

    process.stdin.on("data", (key) => {
      const k = key.toString();

      if (k === "\x1b[A") {
        // Arrow Up
        selected = (selected - 1 + MENU_OPTIONS.length) % MENU_OPTIONS.length;
        render();
      } else if (k === "\x1b[B") {
        // Arrow Down
        selected = (selected + 1) % MENU_OPTIONS.length;
        render();
      } else if (k === "\r" || k === "\n") {
        // Enter
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        rl.close();
        process.stdout.write(`\x1b[${render.lines}A\x1b[0J`);
        const choice = MENU_OPTIONS[selected];
        console.log(`\n  \u2714  Mode: \x1b[1;32m${choice.label}\x1b[0m\n`);
        resolve(choice.value);
      } else if (k === "\x03") {
        // Ctrl+C
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        rl.close();
        process.exit(0);
      }
    });
  });
}

// -- State --
let lastTrackKey  = null;
let currentLyrics = null;
let currentMeta   = null;

function extrapolate(track) {
  let pos = track.positionMs + track.elapsedSinceUpdateMs;
  if (track.durationMs) pos = Math.min(pos, track.durationMs);
  return pos;
}

// -- Tick --
async function tick(webUrl, mode) {
  const track = await getCurrentTrack();

  if (!track) {
    await clearStatus(TOKEN);
    lastTrackKey  = null;
    currentLyrics = null;
    currentMeta   = null;
    if (mode !== MODE.DASHBOARD) {
      renderIdle("Menunggu Spotify memutar sesuatu...");
    }
    broadcastState({ playing: false });
    return;
  }

  const trackKey = `${track.artist}|${track.title}`;

  if (trackKey !== lastTrackKey) {
    lastTrackKey = trackKey;
    [currentLyrics, currentMeta] = await Promise.all([
      getSyncedLyrics(track.artist, track.title, track.durationMs),
      getTrackMeta(track.artist, track.title),
    ]);
  }

  const position  = extrapolate(track);
  const lyricLine = currentLyrics ? findCurrentLine(currentLyrics, position) : null;

  if (DEBUG) {
    console.log(`[debug] pos=${position} line="${lyricLine?.text}"`);
  }

  if (lyricLine) {
    setStatus(TOKEN, `🎵 ${lyricLine.text}`);
  } else if (!currentLyrics) {
    setStatus(TOKEN, `🎵 ${track.title} — ${track.artist}`);
  }

  const payload = {
    playing:    true,
    title:      track.title,
    artist:     track.artist,
    positionMs: position,
    durationMs: track.durationMs,
    lyricLine:  lyricLine?.text ?? (currentLyrics ? null : `${track.title} — ${track.artist}`),
    hasLyrics:  !!currentLyrics,
    genre:      currentMeta?.genre ?? null,
    artworkUrl: currentMeta?.artworkUrl ?? null,
  };

  if (mode !== MODE.DASHBOARD) {
    renderNowPlaying({ ...payload, webUrl });
  }

  broadcastState(payload);
}

// -- Boot --
printStartupBanner();

const mode = await promptMode();

let webUrl = null;

if (mode === MODE.TERMINAL) {
  renderIdle("Menyiapkan koneksi (mode: terminal)...");
} else {
  webUrl = startWebServer(WEB_PORT);
  console.log(`🌐  Web dashboard: \x1b[34m${webUrl}\x1b[0m\n`);

  if (mode === MODE.DASHBOARD) {
    const { exec } = await import("child_process");
    exec(`start ${webUrl}`);
    console.log("🖥️   Browser dibuka otomatis...\n");
  } else {
    renderIdle("Menyiapkan koneksi (mode: terminal + dashboard)...");
  }
}

const tickFn = () => tick(webUrl, mode).catch((e) => console.error("Error:", e.message));
setInterval(tickFn, POLL_INTERVAL);
tickFn();

process.on("SIGINT", async () => {
  await clearStatus(TOKEN);
  console.log("\n\nDihentikan. Status Discord sudah dibersihkan.");
  process.exit(0);
});
