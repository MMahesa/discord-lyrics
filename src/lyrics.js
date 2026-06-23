import axios from "axios";

const LRCLIB_BASE = "https://lrclib.net/api";
const cache = new Map();

function parseLrc(lrcText) {
  const lines = lrcText.split("\n");
  const result = [];
  const timeTagRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  for (const line of lines) {
    const matches = [...line.matchAll(timeTagRegex)];
    if (matches.length === 0) continue;

    const text = line.replace(timeTagRegex, "").trim();

    for (const m of matches) {
      const minutes = parseInt(m[1], 10);
      const seconds = parseInt(m[2], 10);
      const fraction = m[3].length === 2 ? parseInt(m[3], 10) * 10 : parseInt(m[3], 10);
      const timeMs = minutes * 60000 + seconds * 1000 + fraction;
      result.push({ timeMs, text: text || "♪" });
    }
  }

  result.sort((a, b) => a.timeMs - b.timeMs);
  return result;
}

export async function getSyncedLyrics(artist, title, durationMs) {
  const cacheKey = `${artist.toLowerCase()}|${title.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const res = await axios.get(`${LRCLIB_BASE}/get`, {
      params: {
        artist_name: artist,
        track_name: title,
        duration: durationMs ? Math.round(durationMs / 1000) : undefined,
      },
      headers: {
        "User-Agent": "discord-lyrics/1.0.0 (https://github.com/mmahesa/discord-lyrics)",
      },
      timeout: 15000,
    });

    if (!res.data.syncedLyrics) {
      cache.set(cacheKey, null);
      return null;
    }

    const parsed = parseLrc(res.data.syncedLyrics);
    cache.set(cacheKey, parsed);
    setTimeout(() => cache.delete(cacheKey), 10 * 60 * 1000);

    return parsed;
  } catch (err) {
    if (err.response?.status === 404) {
      cache.set(cacheKey, null);
      return null;
    }
    console.error("Gagal mengambil lirik:", err.code || err.message);
    return null;
  }
}

export function findCurrentLine(lyricsArray, positionMs) {
  if (!lyricsArray || lyricsArray.length === 0) return null;

  let current = null;
  for (const line of lyricsArray) {
    if (line.timeMs <= positionMs) {
      current = line;
    } else {
      break;
    }
  }
  return current;
}