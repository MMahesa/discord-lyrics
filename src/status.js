import axios from "axios";

const DISCORD_API         = "https://discord.com/api/v9";
const MIN_UPDATE_INTERVAL = 800;
const MAX_STATUS_LENGTH   = 128;

let lastUpdateTime = 0;
let lastSentText   = null;   // text that was actually dispatched
let queuedText     = null;   // latest text waiting for rate-limit window
let pendingTimer   = null;

function truncate(text, max = MAX_STATUS_LENGTH) {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

/** Sends the PATCH to Discord, retries once on 429 */
async function pushStatus(token, text) {
  try {
    await axios.patch(
      `${DISCORD_API}/users/@me/settings`,
      { custom_status: { text: truncate(text) } },
      {
        headers: { Authorization: token, "Content-Type": "application/json" },
        timeout: 5_000,
      },
    );
    lastUpdateTime = Date.now();
    lastSentText   = text;
  } catch (err) {
    if (err.response?.status === 429) {
      const retryAfter = (err.response.data?.retry_after ?? 1);
      // Only retry if the text is still the latest queued value
      setTimeout(() => {
        if (queuedText === null && lastSentText !== text) pushStatus(token, text);
      }, retryAfter * 1000);
    } else if (err.response?.status === 401) {
      console.error("Discord token is invalid or expired. Check DISCORD_USER_TOKEN in .env");
    } else {
      console.error("Failed to update Discord status:", err.message);
      // Allow retry on next tick by resetting lastSentText
      if (lastSentText === text) lastSentText = null;
    }
  }
}

/**
 * Schedules a Discord status update, rate-limited to MIN_UPDATE_INTERVAL ms.
 * Skips if the text hasn't changed since the last successful send.
 */
export function setStatus(token, text) {
  // Skip if already sent this exact text and nothing is pending
  if (text === lastSentText && queuedText === null) return;

  queuedText = text;

  const elapsed = Date.now() - lastUpdateTime;
  if (elapsed >= MIN_UPDATE_INTERVAL) {
    const toSend = queuedText;
    queuedText = null;
    pushStatus(token, toSend);
  } else if (!pendingTimer) {
    const wait = MIN_UPDATE_INTERVAL - elapsed;
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      if (queuedText !== null) {
        const toSend = queuedText;
        queuedText = null;
        pushStatus(token, toSend);
      }
    }, wait);
  }
}

/** Clears the Discord custom status; no-op if already cleared */
export async function clearStatus(token) {
  if (lastSentText === null && queuedText === null) return;
  // Cancel any pending update
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  queuedText   = null;
  lastSentText = null;
  await pushStatus(token, "");
}
