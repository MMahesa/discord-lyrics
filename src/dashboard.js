import chalk from "chalk";

// ── Unicode East Asian Width helper ──────────────────────────────────────────
// CJK, Hangul, Hiragana, Katakana, Fullwidth, emoji, etc. all occupy 2 terminal
// columns instead of 1.  JavaScript's String.length and .slice() work on
// UTF-16 code units, not characters or columns — so we need our own counter.
function charColWidth(cp) {
  /* eslint-disable no-multi-spaces */
  return (
    (cp >= 0x1100 && cp <= 0x115F) ||   // Hangul Jamo
    (cp >= 0x2E80 && cp <= 0x303E) ||   // CJK Radicals, Kangxi, etc.
    (cp >= 0x3041 && cp <= 0x33BF) ||   // Hiragana, Katakana, Bopomofo, etc.
    (cp >= 0x33FF && cp <= 0xA4CF) ||   // CJK Unified Ideographs + Extensions
    (cp >= 0xAC00 && cp <= 0xD7AF) ||   // Hangul Syllables
    (cp >= 0xF900 && cp <= 0xFAFF) ||   // CJK Compatibility Ideographs
    (cp >= 0xFE10 && cp <= 0xFE1F) ||   // Vertical Forms
    (cp >= 0xFE30 && cp <= 0xFE6F) ||   // CJK Compatibility Forms
    (cp >= 0xFF00 && cp <= 0xFF60) ||   // Fullwidth Latin / Halfwidth Katakana
    (cp >= 0xFFE0 && cp <= 0xFFE6) ||   // Fullwidth Signs
    (cp >= 0x1B000 && cp <= 0x1B0FF) || // Kana Supplement
    (cp >= 0x1F000 && cp <= 0x1FAFF) || // Emoji (Misc Symbols, Emoticons, Supplemental Symbols…)
    (cp >= 0x20000 && cp <= 0x2FA1F)    // CJK Extension B–F + Compat.
  ) ? 2 : 1;
  /* eslint-enable no-multi-spaces */
}

// Strip ANSI escape codes, then count visual terminal columns
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function colWidth(str) {
  const plain = str.replace(ANSI_RE, "");
  let w = 0;
  for (const ch of plain) w += charColWidth(ch.codePointAt(0));
  return w;
}

// Truncate to at most maxCols terminal columns (handles surrogate pairs via for…of)
function truncateCols(text, maxCols) {
  const chars = [...text]; // for…of gives real Unicode code points
  let cols = 0;
  let i = 0;
  while (i < chars.length) {
    const w = charColWidth(chars[i].codePointAt(0));
    if (cols + w > maxCols) return chars.slice(0, i).join("") + "…";
    cols += w;
    i++;
  }
  return text;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const BOX_WIDTH = 60; // total terminal columns including borders

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min      = Math.floor(totalSec / 60);
  const sec      = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function progressBar(positionMs, durationMs, width = 28) {
  if (!durationMs) return chalk.gray("─".repeat(width));
  const ratio  = Math.min(positionMs / durationMs, 1);
  const filled = Math.round(ratio * width);
  return chalk.green("━".repeat(filled)) + chalk.gray("─".repeat(width - filled));
}

// ── Box drawing ───────────────────────────────────────────────────────────────
function boxLine(coloredContent = "") {
  const innerCols  = BOX_WIDTH - 4; // space inside "│ " and " │"
  const contentW   = colWidth(coloredContent);
  const padding    = Math.max(0, innerCols - contentW);
  return chalk.gray("│ ") + coloredContent + " ".repeat(padding) + chalk.gray(" │");
}

const topBorder    = () => chalk.gray("╭" + "─".repeat(BOX_WIDTH - 2) + "╮");
const bottomBorder = () => chalk.gray("╰" + "─".repeat(BOX_WIDTH - 2) + "╯");
const divider      = () => chalk.gray("├" + "─".repeat(BOX_WIDTH - 2) + "┤");

// Header row: title on the left, live clock on the right
function appHeader() {
  const inner   = BOX_WIDTH - 4; // 56 usable cols
  const title   = " 🎵 Discord Lyrics Status";
  const now     = new Date();
  const clock   = now.toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit", hour12: false });
  const clockW  = colWidth(clock);
  const titleW  = colWidth(title);
  const gap     = Math.max(1, inner - titleW - clockW);
  return (
    chalk.gray("│ ") +
    chalk.bold.white(title) +
    " ".repeat(gap) +
    chalk.gray(clock) +
    chalk.gray(" │")
  );
}

// ── Render engine ─────────────────────────────────────────────────────────────
let lastRenderLines = 0;

function render(rows) {
  // Filter out any null/undefined rows (conditional rows passed as null)
  const lines = rows.filter(Boolean);
  if (lastRenderLines > 0) {
    process.stdout.write(`\x1b[${lastRenderLines}A\x1b[0J`);
  }
  process.stdout.write(lines.join("\n") + "\n");
  lastRenderLines = lines.length;
}

// ── Ensure stdout is UTF-8 on Windows ────────────────────────────────────────
if (process.platform === "win32") {
  try {
    const { execSync } = await import("child_process");
    execSync("chcp 65001", { stdio: "ignore" });
  } catch { /* ignore — best-effort */ }
}
if (process.stdout.setEncoding) process.stdout.setEncoding("utf8");
if (process.stderr.setEncoding) process.stderr.setEncoding("utf8");

// ── Public API ────────────────────────────────────────────────────────────────
export function renderIdle(message) {
  const INNER = BOX_WIDTH - 10;
  render([
    topBorder(),
    appHeader(),
    divider(),
    boxLine(`  ${chalk.yellow("◌")}  ${chalk.yellow(truncateCols(message, INNER))}`),
    bottomBorder(),
  ]);
}

export function renderNowPlaying({
  artist, title, positionMs, durationMs,
  lyricLine, prevLyric, nextLyric,
  hasLyrics, genre, album, webUrl,
}) {
  const INNER = BOX_WIDTH - 8;

  const titleStr  = chalk.bold.white(truncateCols(title  || "—", INNER));
  const artistStr = chalk.gray(truncateCols(artist || "—", INNER));
  const timeInfo  = `${formatTime(positionMs)} / ${formatTime(durationMs)}`;
  const bar       = progressBar(positionMs, durationMs);
  const barLine   = `  ${bar}  ${chalk.gray(timeInfo)}`;

  // ── Lyric display helpers ──
  const lyricText = lyricLine || (hasLyrics ? "♪" : "(lyrics unavailable)");
  const lyricDisplay = hasLyrics
    ? chalk.cyan(truncateCols(lyricText, INNER + 2))
    : chalk.gray(truncateCols(lyricText, INNER + 2));

  const dimLine = (text) => chalk.dim(chalk.gray(truncateCols(text, INNER + 2)));

  // ── Build row list ─────────────────────────────────────────────────────────
  const rows = [
    topBorder(),
    appHeader(),
    divider(),
    boxLine(`  ${titleStr}`),
    boxLine(`  ${artistStr}`),
  ];

  // Album name (dim, italic feel via chalk.dim)
  if (album) {
    rows.push(boxLine(`  ${chalk.dim(truncateCols(album, INNER))}`));
  }

  // Genre badge
  if (genre) {
    rows.push(boxLine(`  ${chalk.magenta("◆")} ${chalk.magenta(truncateCols(genre, INNER - 4))}`));
  }

  rows.push(
    boxLine(""),
    boxLine(barLine),
    boxLine(""),
    divider(),
  );

  // Lyric context: prev (dim) → current (highlighted) → next (dim)
  if (hasLyrics) {
    if (prevLyric) rows.push(boxLine(`  ${dimLine(prevLyric)}`));
    rows.push(boxLine(`  ${lyricDisplay}`));
    if (nextLyric) rows.push(boxLine(`  ${dimLine(nextLyric)}`));
  } else {
    rows.push(boxLine(`  ${lyricDisplay}`));
  }

  rows.push(divider());

  // Web URL row — emoji 🌐 is now correctly counted as 2 cols via charColWidth
  if (webUrl) {
    rows.push(boxLine(`  ${"🌐"} ${chalk.blue(webUrl)}`));
  }

  rows.push(bottomBorder());
  render(rows);
}

export function printStartupBanner() {
  console.log(chalk.bold.white("Discord Lyrics Status"));
  console.log(chalk.gray("created by mmahesa\n"));
  console.log(chalk.blue("https://github.com/MMahesa") + "\n");
}
