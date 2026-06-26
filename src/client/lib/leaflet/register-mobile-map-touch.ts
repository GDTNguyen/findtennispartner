import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';

import { prefersNativeTouchPinch } from './touch-capabilities';
import { isMapTouchSurface, MAP_PAN_COMMIT_PX } from './map-touch-surface';

type TouchSession = {
  identifier: number;
  startX: number;
  startY: number;
  panCommitted: boolean;
};

/**
 * Isolate map gestures from the Reddit feed: small movement = tap, larger = pan/pinch.
 * Avoids preventDefault on every touchmove so pin taps stay reliable.
 */
export function registerMobileMapTouch(map: LeafletMap): () => void {
  if (typeof document === 'undefined') return () => {};

  const container = map.getContainer();
  L.DomEvent.disableScrollPropagation(container);
  L.DomEvent.disableClickPropagation(container);

  if (!prefersNativeTouchPinch()) {
    return () => {};
  }

  let session: TouchSession | null = null;
  const commitPxSq = MAP_PAN_COMMIT_PX * MAP_PAN_COMMIT_PX;

  const resetSession = () => {
    session = null;
  };

  const onTouchStart = (e: TouchEvent) => {
    if (!isMapTouchSurface(container, e.target)) {
      resetSession();
      return;
    }

    if (e.touches.length >= 2) {
      resetSession();
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;

    session = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      panCommitted: false,
    };
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length >= 2) {
      resetSession();
      if (e.cancelable) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (!session || e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch || touch.identifier !== session.identifier) return;

    if (!session.panCommitted) {
      const dx = touch.clientX - session.startX;
      const dy = touch.clientY - session.startY;
      if (dx * dx + dy * dy >= commitPxSq) {
        session.panCommitted = true;
      }
    }

    if (session.panCommitted && e.cancelable) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      resetSession();
      return;
    }

    if (session && e.touches.length === 1) {
      const touch = e.touches[0];
      if (!touch || touch.identifier !== session.identifier) {
        resetSession();
      }
    }
  };

  const onTouchCancel = () => {
    resetSession();
  };

  container.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
  container.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
  container.addEventListener('touchcancel', onTouchCancel, { passive: true, capture: true });

  return () => {
    container.removeEventListener('touchstart', onTouchStart, true);
    container.removeEventListener('touchmove', onTouchMove, true);
    container.removeEventListener('touchend', onTouchEnd, true);
    container.removeEventListener('touchcancel', onTouchCancel, true);
  };
}

export function mobileMapInteractionOptions(): Pick<
  L.MapOptions,
  'tapTolerance' | 'inertia' | 'inertiaDeceleration' | 'inertiaMaxSpeed' | 'zoomSnap'
> {
  if (!prefersNativeTouchPinch()) {
    return {
      tapTolerance: 12,
      inertia: true,
      inertiaDeceleration: 2400,
      inertiaMaxSpeed: 1800,
      zoomSnap: 0,
    };
  }

  return {
    tapTolerance: 10,
    inertia: true,
    inertiaDeceleration: 3000,
    inertiaMaxSpeed: 2000,
    zoomSnap: 0,
  };
}
