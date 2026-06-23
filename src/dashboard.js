import chalk from "chalk";

const BOX_WIDTH = 58; // visual width of the entire box

// Strip ANSI escape codes to measure true visual width
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function vlen(str) {
  return str.replace(ANSI_RE, "").length;
}

// Truncate plain text before coloring (avoids mid-ANSI cuts)
function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function progressBar(positionMs, durationMs, width = 28) {
  if (!durationMs) return chalk.gray("─".repeat(width));
  const ratio = Math.min(positionMs / durationMs, 1);
  const filled = Math.round(ratio * width);
  return chalk.green("━".repeat(filled)) + chalk.gray("─".repeat(width - filled));
}

// Build a padded box line with proper visual-length measurement
function line(coloredContent = "") {
  const inner = BOX_WIDTH - 4; // space between "│ " and " │"
  const visualWidth = vlen(coloredContent);
  const pad = Math.max(0, inner - visualWidth);
  return chalk.gray("│ ") + coloredContent + " ".repeat(pad) + chalk.gray(" │");
}

function topBorder() {
  return chalk.gray("╭" + "─".repeat(BOX_WIDTH - 2) + "╮");
}
function bottomBorder() {
  return chalk.gray("╰" + "─".repeat(BOX_WIDTH - 2) + "╯");
}
function border(char = "─") {
  return chalk.gray("├" + char.repeat(BOX_WIDTH - 2) + "┤");
}
function header() {
  const title = " 🎵 Discord Lyrics Status";
  const inner = BOX_WIDTH - 4;
  const pad = Math.max(0, inner - vlen(title));
  return chalk.gray("│ ") + chalk.bold.white(title) + " ".repeat(pad) + chalk.gray(" │");
}

let lastRenderLines = 0;

function render(rows) {
  if (lastRenderLines > 0) {
    process.stdout.write(`\x1b[${lastRenderLines}A\x1b[0J`);
  }
  process.stdout.write(rows.join("\n") + "\n");
  lastRenderLines = rows.length;
}

export function renderIdle(message) {
  render([
    topBorder(),
    header(),
    border(),
    line(`  ${chalk.yellow("◌")}  ${chalk.yellow(truncate(message, BOX_WIDTH - 10))}`),
    bottomBorder(),
  ]);
}

export function renderNowPlaying({
  artist, title, positionMs, durationMs, lyricLine, hasLyrics, genre, webUrl
}) {
  const INNER = BOX_WIDTH - 8; // usable text width inside "│   " and "   │"
  const titleStr   = chalk.bold.white(truncate(title, INNER));
  const artistStr  = chalk.gray(truncate(artist, INNER));
  const timeInfo   = `${formatTime(positionMs)} / ${formatTime(durationMs)}`;
  const bar        = progressBar(positionMs, durationMs);
  const barLine    = `  ${bar}  ${chalk.gray(timeInfo)}`;
  const lyricDisplay = hasLyrics
    ? chalk.cyan(truncate(lyricLine || "♪", INNER + 2))
    : chalk.gray(truncate(lyricLine || "(lirik tidak tersedia)", INNER + 2));

  const rows = [
    topBorder(),
    header(),
    border(),
    line(`  ${titleStr}`),
    line(`  ${artistStr}`),
  ];

  if (genre) {
    rows.push(line(`  ${chalk.magenta("◆")} ${chalk.magenta(truncate(genre, INNER - 4))}`));
  }

  rows.push(
    line(""),
    line(barLine),
    line(""),
    border("─"),
    line(`  ${lyricDisplay}`),
    border("─"),
  );

  if (webUrl) {
    rows.push(line(`  ${chalk.gray("🌐")} ${chalk.blue(webUrl)}`));
  }

  rows.push(bottomBorder());
  render(rows);
}

export function printStartupBanner() {
  console.log(chalk.bold.white("Discord Lyrics Status"));
  console.log(chalk.gray("created by mmahesa\n"));
  console.log(chalk.blue("https://github.com/MMahesa") + "\n");
}
