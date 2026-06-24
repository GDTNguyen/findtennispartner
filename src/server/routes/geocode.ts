import type { GeocodeSearchHit } from '../../shared/api';

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'find10spartner/0.0.1 (Reddit Devvit app; hitting partner map)';

type NominatimRow = {
  lat?: string;
  lon?: string;
  display_name?: string;
};

function geocodeRelevanceScore(query: string, displayName: string): number {
  const q = query.trim().toLowerCase();
  const name = displayName.toLowerCase();
  if (!q) return 0;

  let score = 0;
  if (name.startsWith(q)) score += 200;
  else if (name.includes(q)) score += 100;

  for (const word of q.split(/\s+/).filter(Boolean)) {
    if (name.includes(word)) score += 15;
  }
  return score;
}

function rankGeocodeHits(query: string, hits: GeocodeSearchHit[]): GeocodeSearchHit[] {
  return [...hits].sort(
    (a, b) =>
      geocodeRelevanceScore(query, b.display_name) - geocodeRelevanceScore(query, a.display_name)
  );
}

function dedupeGeocodeHits(hits: GeocodeSearchHit[]): GeocodeSearchHit[] {
  const seen = new Set<string>();
  const out: GeocodeSearchHit[] = [];
  for (const hit of hits) {
    const key = `${hit.lat},${hit.lon}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

async function nominatimSearchOnce(query: string, limit: number): Promise<GeocodeSearchHit[]> {
  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '0');

  const res = await fetch(url.toString(), {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Nominatim returned HTTP ${res.status}`);
  }

  const rows = (await res.json()) as NominatimRow[];
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row.lat && row.lon && row.display_name)
    .map((row) => ({
      lat: row.lat!,
      lon: row.lon!,
      display_name: row.display_name!,
    }));
}

export async function searchPlaces(query: string, limit = 6): Promise<GeocodeSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const lim = Math.min(Math.max(limit, 1), 10);
  const hits = dedupeGeocodeHits(rankGeocodeHits(q, await nominatimSearchOnce(q, lim)));
  return hits.slice(0, lim);
}
