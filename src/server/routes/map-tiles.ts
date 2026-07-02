// Reddit's Devvit domain allowlist rejected the a/b/c.tile.openstreetmap.org
// subdomains, so tiles served from there fail. The CartoCDN basemap
// subdomains (a/b/c/d.basemaps.cartocdn.com) are all approved, so we proxy
// those instead. Voyager is a clean, OSM-derived raster style.
const CARTO_SUBDOMAINS = ['a', 'b', 'c', 'd'] as const;
const CARTO_STYLE = 'rastertiles/voyager';

/** Devvit serverless `fetch` resets connections when too many hit Carto at once. */
const MAX_UPSTREAM_CONCURRENT = 2;
const MAX_UPSTREAM_RETRIES = 4;
const UPSTREAM_RETRY_BASE_MS = 200;
const TILE_CACHE_MAX_ENTRIES = 256;
const TILE_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

type TileCoords = { z: number; x: number; y: number };

type CachedTile = {
  body: ArrayBuffer;
  contentType: string;
  cachedAt: number;
};

const tileCache = new Map<string, CachedTile>();
const inFlight = new Map<string, Promise<CachedTile | null>>();

let upstreamActive = 0;
const upstreamPending: Array<() => void> = [];

function pumpUpstreamQueue(): void {
  while (upstreamActive < MAX_UPSTREAM_CONCURRENT && upstreamPending.length > 0) {
    const job = upstreamPending.shift();
    if (!job) return;
    upstreamActive += 1;
    job();
  }
}

function enqueueUpstream<T>(run: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    upstreamPending.push(() => {
      void run()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          upstreamActive = Math.max(0, upstreamActive - 1);
          pumpUpstreamQueue();
        });
    });
    pumpUpstreamQueue();
  });
}

function tileCacheKey(coords: TileCoords): string {
  return `${coords.z}/${coords.x}/${coords.y}`;
}

function trimTileCache(): void {
  if (tileCache.size <= TILE_CACHE_MAX_ENTRIES) return;
  const oldest = tileCache.keys().next().value;
  if (oldest) tileCache.delete(oldest);
}

function readCachedTile(key: string): CachedTile | null {
  const hit = tileCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > TILE_CACHE_TTL_MS) {
    tileCache.delete(key);
    return null;
  }
  return hit;
}

function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('econnreset') ||
    msg.includes('unavailable') ||
    msg.includes('etimedout') ||
    msg.includes('socket') ||
    msg.includes('network') ||
    msg.includes('aborted')
  );
}

function parseTileCoords(
  zRaw: string,
  xRaw: string,
  yRaw: string
): TileCoords | null {
  const yClean = yRaw.replace('@2x', '').replace(/\.png$/i, '');
  const z = Math.round(Number.parseFloat(zRaw));
  const x = Number.parseInt(xRaw, 10);
  const y = Number.parseInt(yClean, 10);

  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (z < 0 || z > 19 || x < 0 || y < 0) return null;
  if (String(z) !== zRaw.trim() && !Number.isInteger(Number.parseFloat(zRaw))) {
    console.warn('[find10spartner:map-tiles] Fractional zoom coerced', { zRaw, z });
  }

  return { z, x, y };
}

function cartoTileUrl(z: number, x: number, y: number): string {
  const subdomain = CARTO_SUBDOMAINS[(x + y) % CARTO_SUBDOMAINS.length]!;
  return `https://${subdomain}.basemaps.cartocdn.com/${CARTO_STYLE}/${z}/${x}/${y}.png`;
}

async function fetchCartoTileBody(coords: TileCoords): Promise<CachedTile | null> {
  const url = cartoTileUrl(coords.z, coords.x, coords.y);

  for (let attempt = 0; attempt <= MAX_UPSTREAM_RETRIES; attempt++) {
    try {
      const response = await enqueueUpstream(() =>
        fetch(url, {
          headers: {
            'User-Agent': 'find10spartner/0.0.1 (Reddit Devvit app; hitting partner map)',
          },
        })
      );

      if (!response.ok) {
        console.error('[find10spartner:map-tiles] Upstream tile request failed', {
          z: coords.z,
          x: coords.x,
          y: coords.y,
          url,
          status: response.status,
          attempt,
        });
        if (response.status >= 500 && attempt < MAX_UPSTREAM_RETRIES) {
          await new Promise((r) => setTimeout(r, UPSTREAM_RETRY_BASE_MS * 2 ** attempt));
          continue;
        }
        return null;
      }

      const contentType = response.headers.get('content-type') ?? 'image/png';
      const body = await response.arrayBuffer();
      return { body, contentType, cachedAt: Date.now() };
    } catch (error) {
      const retryable = isRetryableFetchError(error);
      console.error('[find10spartner:map-tiles] Upstream tile fetch error', {
        z: coords.z,
        x: coords.x,
        y: coords.y,
        url,
        attempt,
        retryable,
        error,
      });
      if (retryable && attempt < MAX_UPSTREAM_RETRIES) {
        await new Promise((r) => setTimeout(r, UPSTREAM_RETRY_BASE_MS * 2 ** attempt));
        continue;
      }
      throw error;
    }
  }

  return null;
}

async function loadTile(coords: TileCoords): Promise<CachedTile | null> {
  const key = tileCacheKey(coords);
  const cached = readCachedTile(key);
  if (cached) return cached;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = fetchCartoTileBody(coords)
    .then((tile) => {
      if (tile) {
        tileCache.set(key, tile);
        trimTileCache();
      }
      return tile;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

export async function fetchOsmBasemapTile(
  zRaw: string,
  xRaw: string,
  yRaw: string
): Promise<Response | null> {
  const coords = parseTileCoords(zRaw, xRaw, yRaw);
  if (!coords) return null;

  const tile = await loadTile(coords);
  if (!tile) return null;

  return new Response(tile.body, {
    status: 200,
    headers: {
      'Content-Type': tile.contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
