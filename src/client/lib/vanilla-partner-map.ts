import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { PartnerPin } from '../../shared/api';
import {
  CLUSTER_RADIUS_PX,
  DISABLE_CLUSTERING_AT_ZOOM,
  STANDARD_BASEMAP_ATTRIBUTION,
  STANDARD_BASEMAP_URL,
  WORLD_VIEW_CENTER,
  WORLD_VIEW_ZOOM,
} from './map-constants';
import {
  buildPartnerPinPopupHtml,
  createClusterBubbleIcon,
  createPartnerPinIcon,
} from './partner-pin-map';

export type VanillaPartnerMapHandle = {
  map: L.Map;
  cluster: L.MarkerClusterGroup;
  setPlacementMode: (active: boolean) => void;
  syncPins: (pins: PartnerPin[], username: string | null) => void;
  destroy: () => void;
};

function remeasureLeafletMap(map: L.Map) {
  try {
    map.invalidateSize({ animate: false });
    map.setView(map.getCenter(), map.getZoom(), { animate: false });
  } catch {
    /* Map may have been torn down. */
  }
}

/**
 * Imperative Leaflet setup for Devvit's WebView sandbox.
 * React only mounts the container div; all map logic stays vanilla Leaflet.
 */
export function mountVanillaPartnerMap(
  container: HTMLElement,
  options: {
    onMapClick: (lat: number, lng: number) => void;
    onDeletePin: (pinId: string) => void;
    onDraftPost: (pinId: string) => void;
  }
): VanillaPartnerMapHandle {
  container.replaceChildren();

  const map = L.map(container, {
    scrollWheelZoom: true,
    worldCopyJump: true,
    zoomAnimation: true,
    fadeAnimation: true,
    dragging: true,
    touchZoom: true,
    doubleClickZoom: true,
    inertia: true,
  }).setView(WORLD_VIEW_CENTER, WORLD_VIEW_ZOOM);

  L.tileLayer(STANDARD_BASEMAP_URL, {
    maxZoom: 19,
    attribution: STANDARD_BASEMAP_ATTRIBUTION,
  }).addTo(map);

  const cluster = L.markerClusterGroup({
    chunkedLoading: true,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: DISABLE_CLUSTERING_AT_ZOOM,
    maxClusterRadius: CLUSTER_RADIUS_PX,
    iconCreateFunction: (c) => createClusterBubbleIcon(c.getChildCount()),
  }).addTo(map);

  let placementMode = false;

  const onMapClick = (e: L.LeafletMouseEvent) => {
    if (!placementMode) return;
    options.onMapClick(e.latlng.lat, e.latlng.lng);
  };
  map.on('click', onMapClick);

  const onPopupClick = (e: MouseEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const postButton = target.closest('.partner-pin-popup__post');
    if (postButton instanceof HTMLElement) {
      const pinId = postButton.dataset.pinId;
      if (pinId) {
        options.onDraftPost(pinId);
        map.closePopup();
      }
      return;
    }

    const button = target.closest('.partner-pin-popup__delete');
    if (!(button instanceof HTMLElement)) return;
    const pinId = button.dataset.pinId;
    if (!pinId) return;
    options.onDeletePin(pinId);
    map.closePopup();
  };
  map.getContainer().addEventListener('click', onPopupClick);

  const queueRemeasure = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => remeasureLeafletMap(map));
    });
  };

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(queueRemeasure);
    resizeObserver.observe(container);
  }

  map.whenReady(queueRemeasure);

  const syncPins = (pins: PartnerPin[], username: string | null) => {
    cluster.clearLayers();
    for (const pin of pins) {
      const isMine = !!username && pin.username === username;
      const marker = L.marker([pin.lat, pin.lng], {
        icon: createPartnerPinIcon(isMine),
        riseOnHover: true,
      });
      marker.bindPopup(buildPartnerPinPopupHtml(pin, isMine), {
        className: 'partner-pin-popup',
        maxWidth: 280,
      });
      cluster.addLayer(marker);
    }
  };

  const setPlacementMode = (active: boolean) => {
    placementMode = active;
    container.classList.toggle('partner-map-root--placing', active);
  };

  const destroy = () => {
    resizeObserver?.disconnect();
    map.off('click', onMapClick);
    map.getContainer().removeEventListener('click', onPopupClick);
    cluster.clearLayers();
    map.remove();
    container.replaceChildren();
    container.classList.remove('partner-map-root--placing');
  };

  return {
    map,
    cluster,
    setPlacementMode,
    syncPins,
    destroy,
  };
}
