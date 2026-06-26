import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';

import { prefersNativeTouchPinch } from './touch-capabilities';

/**
 * Keep pinch/pan on the map instead of the Reddit iframe or browser scroll chrome.
 */
export function registerMobileMapTouch(map: LeafletMap): () => void {
  if (typeof document === 'undefined') return () => {};

  const container = map.getContainer();
  L.DomEvent.disableScrollPropagation(container);
  L.DomEvent.disableClickPropagation(container);

  if (!prefersNativeTouchPinch()) {
    return () => {};
  }

  let singleTouchActive = false;
  let multiTouchActive = false;

  const isMapSurfaceTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    if (!container.contains(target)) return false;
    return target.closest('.partner-map-search, .leaflet-popup, .leaflet-control') === null;
  };

  const onTouchStart = (e: TouchEvent) => {
    if (!isMapSurfaceTarget(e.target)) {
      singleTouchActive = false;
      multiTouchActive = false;
      return;
    }

    if (e.touches.length === 1) {
      singleTouchActive = true;
      multiTouchActive = false;
      return;
    }

    if (e.touches.length >= 2) {
      singleTouchActive = false;
      multiTouchActive = true;
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!isMapSurfaceTarget(e.target) && !singleTouchActive && !multiTouchActive) return;

    if (e.touches.length >= 2) {
      multiTouchActive = true;
      singleTouchActive = false;
      e.preventDefault();
      return;
    }

    if (singleTouchActive && e.touches.length === 1) {
      e.preventDefault();
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      singleTouchActive = false;
      multiTouchActive = false;
      return;
    }

    if (e.touches.length === 1) {
      multiTouchActive = false;
      singleTouchActive = isMapSurfaceTarget(e.target);
    }
  };

  const onTouchCancel = () => {
    singleTouchActive = false;
    multiTouchActive = false;
  };

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('touchcancel', onTouchCancel, { passive: true });

  return () => {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('touchcancel', onTouchCancel);
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
    tapTolerance: 7,
    inertia: true,
    inertiaDeceleration: 2800,
    inertiaMaxSpeed: 2200,
    zoomSnap: 0,
  };
}
