// Reddit's Devvit domain allowlist rejected the a/b/c.tile.openstreetmap.org
// subdomains, so tiles served from there fail. The CartoCDN basemap
// subdomains (a/b/c/d.basemaps.cartocdn.com) are all approved, so we proxy
// those instead. Voyager is a clean, OSM-derived raster style.
const CARTO_SUBDOMAINS = ['a', 'b', 'c', 'd'] as const;
const CARTO_STYLE = 'rastertiles/voyager';

function parseTileCoords(
  zRaw: string,
  xRaw: string,
  yRaw: string
): { z: number; x: number; y: number } | null {
  const yClean = yRaw.replace('@2x', '').replace(/\.png$/i, '');
  const z = Number.parseInt(zRaw, 10);
  const x = Number.parseInt(xRaw, 10);
  const y = Number.parseInt(yClean, 10);

  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (z < 0 || z > 19 || x < 0 || y < 0) return null;

  return { z, x, y };
}

function cartoTileUrl(z: number, x: number, y: number): string {
  const subdomain = CARTO_SUBDOMAINS[(x + y) % CARTO_SUBDOMAINS.length]!;
  return `https://${subdomain}.basemaps.cartocdn.com/${CARTO_STYLE}/${z}/${x}/${y}.png`;
}

export async function fetchOsmBasemapTile(
  zRaw: string,
  xRaw: string,
  yRaw: string
): Promise<Response | null> {
  const coords = parseTileCoords(zRaw, xRaw, yRaw);
  if (!coords) return null;

  const url = cartoTileUrl(coords.z, coords.x, coords.y);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'find10spartner/0.0.1 (Reddit Devvit app; hitting partner map)',
      },
    });

    if (!response.ok) {
      console.error('[find10spartner:map-tiles] Upstream tile request failed', {
        z: coords.z,
        x: coords.x,
        y: coords.y,
        url,
        status: response.status,
      });
    }

    return response;
  } catch (error) {
    console.error('[find10spartner:map-tiles] Upstream tile fetch error', {
      z: coords.z,
      x: coords.x,
      y: coords.y,
      url,
      error,
    });
    throw error;
  }
}
