import type { Map as LeafletMap } from 'leaflet';

/**
 * Leaflet's map drag handler only attaches from `touchstart` when exactly one
 * finger is down. After a two-finger pinch, lifting one finger leaves the other
 * on the glass — but there was never a single-touch `touchstart`, so panning
 * does not begin until the user lifts and touches again.
 *
 * When a multi-touch gesture settles to exactly one remaining touch, synthesize
 * a `touchstart` for that finger so one-finger pan continues immediately.
 */
type LeafletDraggableInternal = {
  _enabled: boolean;
  _onDown(e: TouchEvent | MouseEvent): void;
};

type LeafletDragHandlerInternal = {
  _draggable?: LeafletDraggableInternal;
};

function isMapSurfaceTarget(container: HTMLElement, target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (!container.contains(target)) return false;
  return target.closest('.partner-map-search, .leaflet-popup, .leaflet-control') === null;
}

function synthesizeTouchStart(e: TouchEvent): TouchEvent | null {
  const touch = e.touches[0];
  if (!touch) return null;

  try {
    const cloned = new Touch({
      identifier: touch.identifier,
      target: touch.target,
      clientX: touch.clientX,
      clientY: touch.clientY,
      pageX: touch.pageX,
      pageY: touch.pageY,
      screenX: touch.screenX,
      screenY: touch.screenY,
      radiusX: touch.radiusX,
      radiusY: touch.radiusY,
      rotationAngle: touch.rotationAngle,
      force: touch.force,
    });
    return new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [cloned],
      targetTouches: [cloned],
      changedTouches: [cloned],
    });
  } catch {
    return null;
  }
}

export function registerPinchPanHandoff(map: LeafletMap): () => void {
  if (typeof document === 'undefined') return () => {};

  const container = map.getContainer();
  let sawMultiTouch = false;

  const onTouchStart = (e: TouchEvent) => {
    if (!isMapSurfaceTarget(container, e.target)) return;
    if (e.touches.length >= 2) sawMultiTouch = true;
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      sawMultiTouch = false;
      return;
    }
    if (!sawMultiTouch || e.touches.length !== 1) return;
    if (!isMapSurfaceTarget(container, e.target)) return;

    sawMultiTouch = false;

    const dragHandler = map.dragging as unknown as LeafletDragHandlerInternal;
    const draggable = dragHandler._draggable;
    if (!draggable?._enabled) return;

    const startEvent = synthesizeTouchStart(e) ?? e;

    requestAnimationFrame(() => {
      if (!map.getContainer()) return;
      draggable._onDown(startEvent);
    });
  };

  const onTouchCancel = (e: TouchEvent) => {
    if (e.touches.length === 0) sawMultiTouch = false;
  };

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('touchcancel', onTouchCancel, { passive: true });

  return () => {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('touchcancel', onTouchCancel);
  };
}
