import type { Map as LeafletMap } from 'leaflet';

/** Place the pin this far down the viewport (0 = top, 1 = bottom). */
const PIN_VIEWPORT_Y_RATIO = 0.74;

/**
 * Pan so the pin sits in the lower portion of the map, leaving room for the
 * popup card above it instead of centering the pin under the popup.
 */
export function panToPinView(map: LeafletMap, lat: number, lng: number): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  try {
    const zoom = map.getZoom();
    const size = map.getSize();
    if (size.y <= 0) {
      map.panTo([lat, lng], { animate: true, duration: 0.45 });
      return;
    }

    const targetPx = map.project([lat, lng], zoom);
    const desiredY = size.y * PIN_VIEWPORT_Y_RATIO;
    const newCenterPx = targetPx.add([0, size.y / 2 - desiredY]);
    const newCenter = map.unproject(newCenterPx, zoom);
    map.panTo(newCenter, { animate: true, duration: 0.45 });
  } catch {
    /* Map may have been torn down mid-flight. */
  }
}
