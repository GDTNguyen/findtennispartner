import L from 'leaflet';

/**
 * Devvit's webview proxies every `/api/...` request to the serverless backend,
 * which only tolerates a couple of in-flight requests at once. Leaflet fires a
 * whole viewport of tiles (8-16) simultaneously, so most never reach the server
 * and the panels stay grey. This layer funnels tile loads through a small
 * priority queue (viewport center first) with retries so the basemap fills in
 * section-by-section instead of waiting for the full batch.
 */
const MAX_CONCURRENT_TILE_REQUESTS = 2;
const MAX_TILE_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 250;

export const TILE_LOAD_ABORTED = 'Tile load aborted';

type QueuedTileJob = {
  priority: number;
  generation: number;
  run: () => void;
};

type GridLayerInternals = L.TileLayer & {
  _map?: L.Map;
  _tileZoom?: number;
  _abortLoading?: () => void;
};

function snapTileCoords(coords: L.Coords): L.Coords {
  const snapped = L.point(Math.floor(coords.x), Math.floor(coords.y)) as L.Coords;
  snapped.z = Math.round(coords.z);
  return snapped;
}

function tileLoadPriority(layer: L.TileLayer, coords: L.Coords): number {
  const map = (layer as GridLayerInternals)._map;
  if (!map) return Number.MAX_SAFE_INTEGER;

  const viewZoom = Math.round(map.getZoom());
  const zoomMismatch = Math.abs(coords.z - viewZoom) * 1_000_000;

  const tileSize = layer.getTileSize();
  const projected = map.project(map.getCenter(), coords.z);
  const centerTileX = projected.x / tileSize.x;
  const centerTileY = projected.y / tileSize.y;
  const dx = coords.x - centerTileX;
  const dy = coords.y - centerTileY;

  return zoomMismatch + dx * dx + dy * dy;
}

class ThrottledTileLayer extends L.TileLayer {
  private activeRequests = 0;
  private pending: QueuedTileJob[] = [];
  /** Bumped only when the tile zoom level changes — not every pan stop. */
  private loadGeneration = 0;
  private loadGenerationTileZoom: number | undefined;

  private pumpQueue(): void {
    while (this.activeRequests < MAX_CONCURRENT_TILE_REQUESTS && this.pending.length > 0) {
      let bestIdx = 0;
      for (let i = 1; i < this.pending.length; i++) {
        if (this.pending[i]!.priority < this.pending[bestIdx]!.priority) {
          bestIdx = i;
        }
      }
      const job = this.pending.splice(bestIdx, 1)[0];
      if (!job) return;
      this.activeRequests += 1;
      job.run();
    }
  }

  private enqueue(priority: number, generation: number, run: () => void): void {
    this.pending.push({ priority, generation, run });
    this.pumpQueue();
  }

  private releaseSlot(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.pumpQueue();
  }

  private clearPendingQueue(): void {
    this.pending = [];
  }

  private bumpGenerationIfTileZoomChanged(): void {
    const tileZoom = (this as unknown as GridLayerInternals)._tileZoom;
    if (tileZoom === undefined) return;
    if (this.loadGenerationTileZoom === tileZoom) return;
    this.loadGenerationTileZoom = tileZoom;
    this.loadGeneration += 1;
    this.clearPendingQueue();
  }

  private finishAborted(img: HTMLElement, done: L.DoneCallback): void {
    done(new Error(TILE_LOAD_ABORTED), img);
  }

  override getTileUrl(coords: L.Coords): string {
    return super.getTileUrl(snapTileCoords(coords));
  }

  override _abortLoading(): void {
    this.bumpGenerationIfTileZoomChanged();
    const proto = L.GridLayer.prototype as GridLayerInternals;
    proto._abortLoading?.call(this);
  }

  override createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement('img');
    img.setAttribute('role', 'presentation');
    img.alt = '';

    const snapped = snapTileCoords(coords);
    if (!Number.isFinite(snapped.z) || snapped.z < 0) {
      done(new Error('Invalid tile zoom'), img);
      return img;
    }

    const url = this.getTileUrl(snapped);
    img.dataset.tileUrl = url;

    const generation = this.loadGeneration;
    const priority = tileLoadPriority(this, snapped);

    const attempt = (tryNumber: number): void => {
      this.enqueue(priority, generation, () => {
        if (generation !== this.loadGeneration) {
          this.releaseSlot();
          this.finishAborted(img, done);
          return;
        }

        fetch(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const contentType = response.headers.get('content-type') ?? '';
            if (!contentType.includes('image')) {
              throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
            }
            return response.blob();
          })
          .then((blob) => {
            if (generation !== this.loadGeneration) {
              this.releaseSlot();
              this.finishAborted(img, done);
              return;
            }
            this.releaseSlot();
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
            this.releaseSlot();
            if (generation !== this.loadGeneration) {
              this.finishAborted(img, done);
              return;
            }
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

const DEFAULT_THROTTLED_TILE_OPTIONS: L.TileLayerOptions = {
  /*
   * Load tiles while the user is still panning/zooming so the viewport is not
   * empty when inertia ends. `getTileUrl` snaps fractional zoom to integers.
   * flyTo still skips mid-animation tile work via Leaflet's internal flyTo flag.
   */
  updateWhenZooming: true,
  updateWhenIdle: false,
  updateInterval: 200,
  keepBuffer: 2,
};

export function createThrottledTileLayer(
  url: string,
  options?: L.TileLayerOptions
): L.TileLayer {
  return new ThrottledTileLayer(url, {
    ...DEFAULT_THROTTLED_TILE_OPTIONS,
    ...options,
  });
}

export function isIgnorableTileLoadError(
  event: L.TileErrorEvent,
): boolean {
  const err = event.error;
  if (err instanceof Error && err.message === TILE_LOAD_ABORTED) {
    return true;
  }
  const tile = event.tile;
  if (!(tile instanceof HTMLImageElement)) {
    return false;
  }
  const src = tile.src.trim();
  if (!src) return true;
  const requested = tile.dataset.tileUrl?.trim() ?? '';
  return !requested;
}
