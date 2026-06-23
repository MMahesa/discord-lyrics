import axios from "axios";

// iTunes Search API \
const ITUNES_BASE = "https://itunes.apple.com/search";
const cache = new Map();

export async function getTrackMeta(artist, title) {
  const key = `${artist.toLowerCase()}|${title.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const res = await axios.get(ITUNES_BASE, {
      params: {
        term: `${artist} ${title}`,
        entity: "song",
        limit: 5,
        media: "music",
      },
      timeout: 8000,
    });

    const results = res.data?.results ?? [];
    if (results.length === 0) {
      cache.set(key, null);
      return null;
    }

    // Find best match by title similarity
    const lTitle = title.toLowerCase();
    const lArtist = artist.toLowerCase();
    const match =
      results.find(
        (r) =>
          r.trackName?.toLowerCase().includes(lTitle) &&
          r.artistName?.toLowerCase().includes(lArtist)
      ) ||
      results.find((r) => r.trackName?.toLowerCase().includes(lTitle)) ||
      results[0];

    const raw100 = match.artworkUrl100 ?? null;
    const meta = {
      artworkUrl: raw100
        ? raw100.replace("100x100bb", "600x600bb")
        : null,
      artworkUrlThumb: raw100,
      genre: match.primaryGenreName ?? null,
      album: match.collectionName ?? null,
    };

    cache.set(key, meta);
    // Cache for 30 minutes
    setTimeout(() => cache.delete(key), 30 * 60 * 1000);
    return meta;
  } catch (err) {
    // Silently fail — metadata is optional
    cache.set(key, null);
    return null;
  }
}
