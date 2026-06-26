/** Phones/tablets should use Leaflet's native TouchZoom instead of WebKit gesture events. */
export function prefersNativeTouchPinch(): boolean {
  if (typeof window === 'undefined') return false;

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  /* Touch-first devices (no mouse/trackpad). */
  if (coarsePointer && !finePointer) return true;

  /* iOS phones/tablets — not Mac laptops (trackpads report maxTouchPoints > 1). */
  return /iPhone|iPod|iPad/i.test(navigator.userAgent);
}

/** Laptops/desktops with a mouse wheel or trackpad scroll. */
export function prefersSmoothWheelZoom(): boolean {
  return !prefersNativeTouchPinch();
}
