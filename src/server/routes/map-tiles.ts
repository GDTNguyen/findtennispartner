const OSM_SUBDOMAINS = ['a', 'b', 'c'] as const;

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

function osmTileUrl(z: number, x: number, y: number): string {
  const subdomain = OSM_SUBDOMAINS[(x + y) % OSM_SUBDOMAINS.length]!;
  return `https://${subdomain}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export async function fetchOsmBasemapTile(
  zRaw: string,
  xRaw: string,
  yRaw: string
): Promise<Response | null> {
  const coords = parseTileCoords(zRaw, xRaw, yRaw);
  if (!coords) return null;

  return fetch(osmTileUrl(coords.z, coords.x, coords.y), {
    headers: {
      'User-Agent': 'find10spartner/0.0.1 (Reddit Devvit app; hitting partner map)',
    },
  });
}
