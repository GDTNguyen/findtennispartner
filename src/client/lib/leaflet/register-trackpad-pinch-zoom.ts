import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';

import './register-smooth-wheel-zoom';

const PINCH_WHEEL_SENSITIVITY_MULTIPLIER = 3.5;
const GESTURE_ZOOM_SENSITIVITY = 2.5;

type SmoothWheelZoomHandler = L.Handler & {
  _onWheelStart(e: WheelEvent | Pick<WheelEvent, 'clientX' | 'clientY' | 'ctrlKey'>): void;
  _onWheeling(e: WheelEvent): void;
  _onWheelEnd(): void;
  _isWheeling?: boolean;
  _goalZoom?: number;
  _wheelMousePosition?: L.Point;
  _wheelMouseLatLng?: L.LatLng;
  _timeoutId?: ReturnType<typeof setTimeout>;
  _map: LeafletMap;
};

type GestureEventLike = Event & {
  scale: number;
  clientX: number;
  clientY: number;
};

type LeafletMapInternal = LeafletMap & {
  smoothWheelZoom?: SmoothWheelZoomHandler;
};

function isTrackpadPinchWheel(e: WheelEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

function clampZoom(map: LeafletMap, zoom: number): number {
  return Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), zoom));
}

function getSmoothWheelHandler(map: LeafletMap): SmoothWheelZoomHandler | undefined {
  return (map as LeafletMapInternal).smoothWheelZoom;
}

function isCenterWheelZoom(map: LeafletMap): boolean {
  return map.options.smoothWheelZoom === 'center';
}

function setWheelHandlerToViewportCenter(handler: SmoothWheelZoomHandler, map: LeafletMap): void {
  const centerPoint = map.getSize().divideBy(2);
  handler._wheelMousePosition = centerPoint;
  handler._wheelMouseLatLng = map.containerPointToLatLng(centerPoint);
}

function applyPinchWheelZoomPatch(): void {
  const SmoothWheelZoom = (L.Map as unknown as { SmoothWheelZoom?: { prototype: SmoothWheelZoomHandler } })
    .SmoothWheelZoom;
  if (!SmoothWheelZoom) return;

  const originalOnWheeling = SmoothWheelZoom.prototype._onWheeling;
  if ((originalOnWheeling as { __f10pPinchPatched?: boolean }).__f10pPinchPatched) return;

  const patchedOnWheeling = function (this: SmoothWheelZoomHandler, e: WheelEvent) {
    if (!isTrackpadPinchWheel(e)) {
      return originalOnWheeling.call(this, e);
    }

    const map = this._map;
    const savedSensitivity = map.options.smoothSensitivity;
    try {
      map.options.smoothSensitivity = (savedSensitivity ?? 1) * PINCH_WHEEL_SENSITIVITY_MULTIPLIER;
      const result = originalOnWheeling.call(this, e);
      if (isCenterWheelZoom(map)) setWheelHandlerToViewportCenter(this, map);
      return result;
    } finally {
      if (savedSensitivity !== undefined) {
        map.options.smoothSensitivity = savedSensitivity;
      } else {
        delete map.options.smoothSensitivity;
      }
    }
  };
  (patchedOnWheeling as { __f10pPinchPatched?: boolean }).__f10pPinchPatched = true;
  SmoothWheelZoom.prototype._onWheeling = patchedOnWheeling;
}

applyPinchWheelZoomPatch();

export function registerTrackpadPinchZoom(map: LeafletMap): () => void {
  if (typeof document === 'undefined') return () => {};

  const container = map.getContainer();

  const onWheelCapture = (e: WheelEvent) => {
    if (isTrackpadPinchWheel(e)) e.preventDefault();
  };
  container.addEventListener('wheel', onWheelCapture, { passive: false, capture: true });

  let gestureActive = false;
  let lastGestureScale = 1;

  const wheelLikeFromGesture = (ge: GestureEventLike): Pick<WheelEvent, 'clientX' | 'clientY' | 'ctrlKey'> => ({
    clientX: ge.clientX,
    clientY: ge.clientY,
    ctrlKey: true,
  });

  const onGestureStart = (e: Event) => {
    e.preventDefault();
    const ge = e as GestureEventLike;
    gestureActive = true;
    lastGestureScale = ge.scale;

    const handler = getSmoothWheelHandler(map);
    if (handler && !handler._isWheeling) {
      handler._onWheelStart(wheelLikeFromGesture(ge));
    }
  };

  const onGestureChange = (e: Event) => {
    e.preventDefault();
    if (!gestureActive) return;

    const ge = e as GestureEventLike;
    const handler = getSmoothWheelHandler(map);
    if (!handler) return;

    const scaleDelta = ge.scale / lastGestureScale;
    lastGestureScale = ge.scale;
    if (scaleDelta === 1) return;

    const sensitivity = map.options.smoothSensitivity ?? 1;
    const zoomDelta = Math.log2(scaleDelta) * GESTURE_ZOOM_SENSITIVITY * sensitivity;
    handler._goalZoom = clampZoom(map, (handler._goalZoom ?? map.getZoom()) + zoomDelta);

    if (isCenterWheelZoom(map)) {
      setWheelHandlerToViewportCenter(handler, map);
    } else {
      handler._wheelMousePosition = map.mouseEventToContainerPoint({
        clientX: ge.clientX,
        clientY: ge.clientY,
      } as MouseEvent);
      handler._wheelMouseLatLng = map.containerPointToLatLng(handler._wheelMousePosition);
    }

    clearTimeout(handler._timeoutId);
    handler._timeoutId = setTimeout(() => handler._onWheelEnd(), 200);
  };

  const onGestureEnd = (e: Event) => {
    e.preventDefault();
    gestureActive = false;
    lastGestureScale = 1;

    const handler = getSmoothWheelHandler(map);
    if (handler?._isWheeling) handler._onWheelEnd();
  };

  container.addEventListener('gesturestart', onGestureStart, { passive: false });
  container.addEventListener('gesturechange', onGestureChange, { passive: false });
  container.addEventListener('gestureend', onGestureEnd, { passive: false });

  return () => {
    container.removeEventListener('wheel', onWheelCapture, true);
    container.removeEventListener('gesturestart', onGestureStart);
    container.removeEventListener('gesturechange', onGestureChange);
    container.removeEventListener('gestureend', onGestureEnd);
  };
}
