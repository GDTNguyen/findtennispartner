import L from 'leaflet';

/**
 * Re-sync the map container after fly/search jumps without `redraw()`, which
 * cancels every in-flight tile and surfaces spurious tileerror events.
 */
export function refreshBasemapAfterViewChange(map: L.Map): void {
  try {
    const el = map.getContainer();
    if (!el?.isConnected) return;

    void el.offsetWidth;
    void el.getBoundingClientRect();

    const center = map.getCenter();
    const zoom = Math.round(map.getZoom());

    map.invalidateSize({ animate: false });
    map.setView(center, zoom, { animate: false });
  } catch {
    /* Map may have unmounted mid-flight. */
  }
}

export function queueBasemapRefreshAfterLayout(map: L.Map): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      refreshBasemapAfterViewChange(map);
    });
  });
}
