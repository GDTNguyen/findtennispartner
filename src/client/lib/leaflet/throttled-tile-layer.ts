import L from 'leaflet';

/**
 * Devvit's webview proxies every `/api/...` request to the serverless backend,
 * which only tolerates a couple of in-flight requests at once. Leaflet fires a
 * whole viewport of tiles (8-16) simultaneously, so most never reach the server
 * and the panels stay grey. This layer funnels tile loads through a small
 * concurrency queue with retries so the basemap fills in reliably.
 */
const MAX_CONCURRENT_TILE_REQUESTS = 2;
const MAX_TILE_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 250;

let activeRequests = 0;
const pending: Array<() => void> = [];

function pumpQueue(): void {
  while (activeRequests < MAX_CONCURRENT_TILE_REQUESTS && pending.length > 0) {
    const job = pending.shift();
    if (!job) return;
    activeRequests += 1;
    job();
  }
}

function enqueue(job: () => void): void {
  pending.push(job);
  pumpQueue();
}

function releaseSlot(): void {
  activeRequests = Math.max(0, activeRequests - 1);
  pumpQueue();
}

class ThrottledTileLayer extends L.TileLayer {
  override createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement('img');
    img.setAttribute('role', 'presentation');
    img.alt = '';
    const url = this.getTileUrl(coords);

    const attempt = (tryNumber: number): void => {
      enqueue(() => {
        fetch(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            return response.blob();
          })
          .then((blob) => {
            releaseSlot();
            const objectUrl = URL.createObjectURL(blob);
            img.onload = () => {
              URL.revokeObjectURL(objectUrl);
              done(undefined, img);
            };
            img.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              done(new Error('Tile image failed to decode'), img);
            };
            img.src = objectUrl;
          })
          .catch((error: unknown) => {
            releaseSlot();
            if (tryNumber < MAX_TILE_RETRIES) {
              window.setTimeout(
                () => attempt(tryNumber + 1),
                RETRY_BASE_DELAY_MS * 2 ** tryNumber
              );
              return;
            }
            done(error instanceof Error ? error : new Error(String(error)), img);
          });
      });
    };

    attempt(0);
    return img;
  }
}

export function createThrottledTileLayer(
  url: string,
  options?: L.TileLayerOptions
): L.TileLayer {
  return new ThrottledTileLayer(url, options);
}
