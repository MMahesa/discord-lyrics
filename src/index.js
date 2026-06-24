import "dotenv/config";
import { getCurrentTrack }                        from "./spotify.js";
import { getSyncedLyrics, findContextLines }      from "./lyrics.js";
import { setStatus, clearStatus }                  from "./status.js";
import { printStartupBanner, renderIdle, renderNowPlaying } from "./dashboard.js";
import { getTrackMeta }                            from "./musicmeta.js";
import { startWebServer, broadcastState }          from "./webserver.js";

// ── env ──────────────────────────────────────────────────────────────────────
const TOKEN         = process.env.DISCORD_USER_TOKEN;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "800", 10);
const WEB_PORT      = parseInt(process.env.WEB_PORT || "3000", 10);
const DEBUG         = process.env.DEBUG_POSITION === "1";

if (!TOKEN) {
  console.error("DISCORD_USER_TOKEN is not set in .env. See README for instructions.");
  process.exit(1);
}

const MODE = {
  BOTH:      "both",
  TERMINAL:  "terminal",
  DASHBOARD: "dashboard",
};

const MENU_OPTIONS = [
  { label: "Terminal + Dashboard (both)", value: MODE.BOTH },
  { label: "Terminal only",               value: MODE.TERMINAL },
  { label: "Dashboard only (opens browser automatically)", value: MODE.DASHBOARD },
];

// ── Interactive arrow-key menu ────────────────────────────────────────────────
function promptMode() {
  return new Promise((resolve) => {
    const envMode = process.env.RUN_MODE?.toLowerCase();
    if (envMode && Object.values(MODE).includes(envMode)) {
      console.log(`\n▶  Mode from .env: ${envMode}\n`);
      resolve(envMode);
      return;
    }

    if (!process.stdin.isTTY) {
      console.log("\n▶  Non-TTY detected — defaulting to: both\n");
      resolve(MODE.BOTH);
      return;
    }

    let selected = 0;

    const ROWS_HEADER = 2;
    let drawnRows = 0;

    function buildRows() {
      const rows = [];
      MENU_OPTIONS.forEach((opt, i) => {
        const arrow  = i === selected ? "  \u276f " : "    ";
        const colour = i === selected ? "\x1b[1;36m" : "\x1b[90m";
        rows.push(`${arrow}${colour}${opt.label}\x1b[0m`);
      });
      rows.push("");
      rows.push("  \x1b[90m\u2191\u2193 navigate  \u2022  Enter to confirm\x1b[0m");
      return rows;
    }

    function renderMenu() {
      if (drawnRows > 0) {
        process.stdout.write(`\x1b[${drawnRows}A\x1b[0J`);
      }
      const rows = buildRows();
      process.stdout.write(rows.join("\n") + "\n");
      drawnRows = rows.length;
    }

    process.stdout.write("\n  Select display mode:\n\n");
    renderMenu();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function onKey(key) {
      switch (key) {
        case "\x1b[A":
          selected = (selected - 1 + MENU_OPTIONS.length) % MENU_OPTIONS.length;
          renderMenu();
          break;

        case "\x1b[B":
          selected = (selected + 1) % MENU_OPTIONS.length;
          renderMenu();
          break;

        case "\r":
        case "\n": {
          process.stdin.setRawMode(false);
          process.stdin.removeListener("data", onKey);
          if (drawnRows > 0) process.stdout.write(`\x1b[${drawnRows}A\x1b[0J`);
          const choice = MENU_OPTIONS[selected];
          console.log(`  \u2714  Mode: \x1b[1;32m${choice.label}\x1b[0m\n`);
          resolve(choice.value);
          break;
        }

        case "\x03":
          process.stdin.setRawMode(false);
          process.stdin.removeListener("data", onKey);
          process.exit(0);
      }
    }

    process.stdin.on("data", onKey);
  });
}

// ── State ────────────────────────────────────────────────────────────────────
let lastTrackKey  = null;
let currentLyrics = null;
let currentMeta   = null;
let isIdle        = true;

// ── Tick mutex — prevents concurrent ticks from racing on lastRenderLines ────
// setInterval fires every POLL_INTERVAL ms regardless of whether the previous
// tick finished (lyrics/meta fetch can take 2-15 s on song change).  Without
// this guard, multiple concurrent render() calls corrupt the cursor-position
// bookkeeping and cause the box to "stack" instead of redrawing in place.
let tickBusy = false;

function extrapolatePosition(track) {
  let pos = track.positionMs + track.elapsedSinceUpdateMs;
  if (track.durationMs) pos = Math.min(pos, track.durationMs);
  return pos;
}

// ── Main tick ─────────────────────────────────────────────────────────────────
async function tick(webUrl, mode) {
  const track = await getCurrentTrack();

  if (!track) {
    if (!isIdle) {
      isIdle = true;
      lastTrackKey  = null;
      currentLyrics = null;
      currentMeta   = null;
      await clearStatus(TOKEN);
    }
    if (mode !== MODE.DASHBOARD) {
      renderIdle("Waiting for Spotify to play something...");
    }
    broadcastState({ playing: false });
    return;
  }

  isIdle = false;

  const trackKey = `${track.artist}|${track.title}`;
  if (trackKey !== lastTrackKey) {
    lastTrackKey  = trackKey;
    // Reset lyrics/meta immediately so stale data from the previous song
    // isn't shown while the new fetch is in progress
    currentLyrics = null;
    currentMeta   = null;
    [currentLyrics, currentMeta] = await Promise.all([
      getSyncedLyrics(track.artist, track.title, track.durationMs),
      getTrackMeta(track.artist, track.title),
    ]);
  }

  const position = extrapolatePosition(track);
  const { prev, current, next } = currentLyrics
    ? findContextLines(currentLyrics, position)
    : { prev: null, current: null, next: null };

  if (DEBUG) {
    console.log(`[debug] pos=${position} line="${current?.text}"`);
  }

  if (current) {
    setStatus(TOKEN, `🎵 ${current.text}`);
  } else if (!currentLyrics) {
    setStatus(TOKEN, `🎵 ${track.title} — ${track.artist}`);
  }

  const payload = {
    playing:    true,
    title:      track.title,
    artist:     track.artist,
    positionMs: position,
    durationMs: track.durationMs,
    lyricLine:  current?.text ?? (currentLyrics ? null : `${track.title} — ${track.artist}`),
    prevLyric:  prev?.text    ?? null,
    nextLyric:  next?.text    ?? null,
    hasLyrics:  !!currentLyrics,
    genre:      currentMeta?.genre      ?? null,
    album:      currentMeta?.album      ?? null,
    artworkUrl: currentMeta?.artworkUrl ?? null,
  };

  if (mode !== MODE.DASHBOARD) {
    renderNowPlaying({ ...payload, webUrl });
  }

  broadcastState(payload);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
printStartupBanner();

const mode = await promptMode();
let webUrl = null;

if (mode === MODE.TERMINAL) {
  renderIdle("Establishing connection (mode: terminal)...");
} else {
  webUrl = startWebServer(WEB_PORT);
  console.log(`🌐  Web dashboard: \x1b[34m${webUrl}\x1b[0m\n`);

  if (mode === MODE.DASHBOARD) {
    const { exec } = await import("child_process");
    const openCmd  = process.platform === "darwin" ? "open"
                   : process.platform === "win32"  ? "start"
                   : "xdg-open";
    exec(`${openCmd} ${webUrl}`);
    console.log("🖥️   Opening browser automatically...\n");
  } else {
    renderIdle("Establishing connection (mode: terminal + dashboard)...");
  }
}

// ── Tick loop — mutex-guarded to prevent concurrent renders ───────────────────
const tickFn = async () => {
  if (tickBusy) return;           // skip this interval if previous tick is still running
  tickBusy = true;
  try {
    await tick(webUrl, mode);
  } catch (e) {
    console.error("Tick error:", e.message);
  } finally {
    tickBusy = false;
  }
};

const interval = setInterval(tickFn, POLL_INTERVAL);
tickFn();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on("SIGINT", async () => {
  clearInterval(interval);
  await clearStatus(TOKEN);
  console.log("\n\nStopped. Discord status has been cleared.");
  process.exit(0);
});
