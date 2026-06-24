import type { Map as LeafletMap } from 'leaflet';

type LeafletDraggableInternal = {
  _enabled: boolean;
  _onDown(e: TouchEvent | MouseEvent): void;
};

type LeafletDragHandlerInternal = {
  _draggable?: LeafletDraggableInternal;
};

export function registerPinchPanHandoff(map: LeafletMap): () => void {
  if (typeof document === 'undefined') return () => {};

  let sawMultiTouch = false;

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length >= 2) sawMultiTouch = true;
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      sawMultiTouch = false;
      return;
    }
    if (!sawMultiTouch || e.touches.length !== 1) return;

    sawMultiTouch = false;

    const container = map.getContainer();
    const target = e.target;
    if (!(target instanceof Node) || !container.contains(target)) return;

    const dragHandler = map.dragging as unknown as LeafletDragHandlerInternal;
    const draggable = dragHandler._draggable;
    if (!draggable?._enabled) return;

    queueMicrotask(() => {
      if (!map.getContainer()) return;
      draggable._onDown(e);
    });
  };

  const onTouchCancel = (e: TouchEvent) => {
    if (e.touches.length === 0) sawMultiTouch = false;
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', onTouchCancel, { passive: true });

  return () => {
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('touchcancel', onTouchCancel);
  };
}
