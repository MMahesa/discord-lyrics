import axios from "axios";

const LRCLIB_BASE  = "https://lrclib.net/api";
const CACHE_TTL_MS = 10 * 60 * 1000;

/** caches parsed lyric arrays keyed by "artist|title" */
const cache = new Map();

// parses LRC text into timed lines, handling multi-tag lines and 2/3-digit centiseconds
function parseLrc(lrcText) {
  const TIME_TAG_RE = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  const result = [];

  for (const line of lrcText.split("\n")) {
    const matches = [...line.matchAll(TIME_TAG_RE)];
    if (matches.length === 0) continue;

    const text = line.replace(TIME_TAG_RE, "").trim();

    for (const m of matches) {
      const minutes  = parseInt(m[1], 10);
      const seconds  = parseInt(m[2], 10);
      const fraction = m[3].length === 2 ? parseInt(m[3], 10) * 10 : parseInt(m[3], 10);
      const timeMs   = minutes * 60_000 + seconds * 1_000 + fraction;
      result.push({ timeMs, text: text || "♪" });
    }
  }

  return result.sort((a, b) => a.timeMs - b.timeMs);
}

/** fetches synced lyrics from lrclib.net, cached for CACHE_TTL_MS */
export async function getSyncedLyrics(artist, title, durationMs) {
  const cacheKey = `${artist.toLowerCase()}|${title.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const res = await axios.get(`${LRCLIB_BASE}/get`, {
      params: {
        artist_name: artist,
        track_name:  title,
        duration:    durationMs ? Math.round(durationMs / 1000) : undefined,
      },
      headers: {
        "User-Agent": "discord-lyrics/1.0.0 (https://github.com/mmahesa/discord-lyrics)",
      },
      timeout: 15_000,
    });

    if (!res.data.syncedLyrics) {
      cache.set(cacheKey, null);
      return null;
    }

    const parsed = parseLrc(res.data.syncedLyrics);
    cache.set(cacheKey, parsed);
    setTimeout(() => cache.delete(cacheKey), CACHE_TTL_MS);
    return parsed;
  } catch (err) {
    if (err.response?.status === 404) {
      cache.set(cacheKey, null);
      return null;
    }
    console.error("Failed to fetch lyrics:", err.code || err.message);
    return null;
  }
}

/**
 * Returns the previous, current, and next lyric lines for the given position.
 * current  = last line whose timeMs <= positionMs
 * prev     = line before current
 * next     = line after current (ignores "♪"-only lines for less visual noise)
 */
export function findContextLines(lyricsArray, positionMs) {
  if (!lyricsArray || lyricsArray.length === 0) {
    return { prev: null, current: null, next: null };
  }

  let idx = -1;
  for (let i = 0; i < lyricsArray.length; i++) {
    if (lyricsArray[i].timeMs <= positionMs) {
      idx = i;
    } else {
      break;
    }
  }

  // find a meaningful next line (skip instrumental-only "♪" markers)
  let nextIdx = idx + 1;
  while (nextIdx < lyricsArray.length && lyricsArray[nextIdx].text === "♪") {
    nextIdx++;
  }

  return {
    prev:    idx > 0                                 ? lyricsArray[idx - 1] : null,
    current: idx >= 0                                ? lyricsArray[idx]     : null,
    next:    nextIdx < lyricsArray.length            ? lyricsArray[nextIdx] : null,
  };
}

/** Kept for compatibility — returns only the current line */
export function findCurrentLine(lyricsArray, positionMs) {
  return findContextLines(lyricsArray, positionMs).current;
}
