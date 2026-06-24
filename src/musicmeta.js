import axios from "axios";

const ITUNES_BASE   = "https://itunes.apple.com/search";
const CACHE_TTL_MS  = 30 * 60 * 1000;
const ARTWORK_SIZE  = "600x600bb";
const ARTWORK_THUMB = "100x100bb";

/** caches metadata objects keyed by "artist|title" */
const cache = new Map();

// prefers exact artist+title match, then title-only, then first result
function findBestMatch(results, artist, title) {
  const lTitle  = title.toLowerCase();
  const lArtist = artist.toLowerCase();

  return (
    results.find(
      (r) =>
        r.trackName?.toLowerCase().includes(lTitle) &&
        r.artistName?.toLowerCase().includes(lArtist),
    ) ||
    results.find((r) => r.trackName?.toLowerCase().includes(lTitle)) ||
    results[0]
  );
}

/**
 * Fetches artwork + genre from the iTunes Search API. Best-effort —
 * failures resolve to null instead of throwing. Cached for CACHE_TTL_MS.
 */
export async function getTrackMeta(artist, title) {
  const cacheKey = `${artist.toLowerCase()}|${title.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const res = await axios.get(ITUNES_BASE, {
      params: {
        term:   `${artist} ${title}`,
        entity: "song",
        limit:  5,
        media:  "music",
      },
      timeout: 8_000,
    });

    const results = res.data?.results ?? [];
    if (results.length === 0) {
      cache.set(cacheKey, null);
      return null;
    }

    const match    = findBestMatch(results, artist, title);
    const rawThumb = match.artworkUrl100 ?? null;
    const meta = {
      artworkUrl:      rawThumb ? rawThumb.replace(ARTWORK_THUMB, ARTWORK_SIZE) : null,
      artworkUrlThumb: rawThumb,
      genre:           match.primaryGenreName ?? null,
      album:           match.collectionName ?? null,
    };

    cache.set(cacheKey, meta);
    setTimeout(() => cache.delete(cacheKey), CACHE_TTL_MS);
    return meta;
  } catch {
    cache.set(cacheKey, null);
    return null;
  }
}
