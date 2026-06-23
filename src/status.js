import axios from "axios";

const DISCORD_API = "https://discord.com/api/v9";
const MIN_UPDATE_INTERVAL_MS = 800;

let lastUpdateTime = 0;
let lastText = null;
let queuedText = null;
let timer = null;

function truncate(text, max = 128) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

async function pushStatus(token, text) {
  try {
    await axios.patch(
      `${DISCORD_API}/users/@me/settings`,
      { custom_status: { text: truncate(text) } },
      {
        headers: { Authorization: token, "Content-Type": "application/json" },
        timeout: 5000,
      }
    );
    lastUpdateTime = Date.now();
  } catch (err) {
    if (err.response?.status === 429) {
      const retryAfter = err.response.data.retry_after || 1;
      setTimeout(() => pushStatus(token, text), retryAfter * 1000);
    } else if (err.response?.status === 401) {
      console.error("Token tidak valid / expired. Cek file .env kamu.");
    } else {
      console.error("Gagal update status:", err.message);
      if (lastText === text) lastText = null;
    }
  }
}

export function setStatus(token, text) {
  if (text === lastText) return;

  lastText = text;
  queuedText = text;
  const elapsed = Date.now() - lastUpdateTime;

  if (elapsed >= MIN_UPDATE_INTERVAL_MS) {
    const toSend = queuedText;
    queuedText = null;
    pushStatus(token, toSend);
  } else if (!timer) {
    const wait = MIN_UPDATE_INTERVAL_MS - elapsed;
    timer = setTimeout(() => {
      timer = null;
      if (queuedText !== null) {
        const toSend = queuedText;
        queuedText = null;
        pushStatus(token, toSend);
      }
    }, wait);
  }
}

export async function clearStatus(token) {
  if (lastText === null) return;
  lastText = null;
  await pushStatus(token, "");
}