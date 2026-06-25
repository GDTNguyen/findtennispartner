export type MapTileError = {
  url: string;
  at: string;
  message: string;
};

export type MapLoadPhase = 'loading' | 'rendering' | 'rendered' | 'failed';

export type MapLoadStatus = {
  phase: MapLoadPhase;
  tilesLoaded: number;
  tilesFailed: number;
  errors: MapTileError[];
};

export const INITIAL_MAP_LOAD_STATUS: MapLoadStatus = {
  phase: 'loading',
  tilesLoaded: 0,
  tilesFailed: 0,
  errors: [],
};

export function mapLoadStatusLabel(status: MapLoadStatus): string {
  switch (status.phase) {
    case 'loading':
      return 'Loading map…';
    case 'rendering':
      if (status.tilesLoaded > 0) {
        return `Rendering map… (${status.tilesLoaded} tiles)`;
      }
      return 'Rendering map…';
    case 'rendered':
      if (status.tilesFailed > 0) {
        return `Map rendered with ${status.tilesFailed} errors`;
      }
      return 'Map rendered';
    case 'failed':
      return `Map failed to render (${status.tilesFailed} errors)`;
  }
}

export function mapLoadStatusTone(status: MapLoadStatus): 'pending' | 'ok' | 'error' {
  if (status.phase === 'failed') return 'error';
  if (status.phase === 'rendered' && status.tilesFailed > 0) return 'error';
  if (status.phase === 'rendered') return 'ok';
  return 'pending';
}
