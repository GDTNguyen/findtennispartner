import { navigateTo } from '@devvit/web/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { PartnerPin } from '../../shared/api';
import {
  DISABLE_CLUSTERING_AT_ZOOM,
  LOCATION_SEARCH_ZOOM,
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
import {
  attachPartnerPinClusterZoomHandlers,
  applyCoincidentPartnerPinSpread,
  clusterRadiusForZoom,
  stampPartnerMarkerOrigin,
} from './partner-pin-clustering';

import {
  INITIAL_MAP_LOAD_STATUS,
  type MapLoadStatus,
  type MapTileError,
} from './map-load-status';
import { reportMapLog } from './report-map-log';
import { panToPinView } from './map-pin-view';
import { createThrottledTileLayer } from './leaflet/throttled-tile-layer';
import './leaflet/register-smooth-wheel-zoom';
import { registerMobileMapTouch, mobileMapInteractionOptions } from './leaflet/register-mobile-map-touch';
import { registerTrackpadPinchZoom } from './leaflet/register-trackpad-pinch-zoom';
import { registerPinchPanHandoff } from './leaflet/register-pinch-pan-handoff';
import { prefersNativeTouchPinch, prefersSmoothWheelZoom } from './leaflet/touch-capabilities';

export type { MapLoadStatus } from './map-load-status';

export type VanillaPartnerMapHandle = {
  map: L.Map;
  cluster: L.MarkerClusterGroup;
  setPlacementMode: (active: boolean) => void;
  syncPins: (pins: PartnerPin[], username: string | null) => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  destroy: () => void;
};

const MAP_LOG_PREFIX = '[find10spartner:map]';

function logMap(message: string, detail?: Record<string, unknown>, level: 'info' | 'error' = 'info') {
  reportMapLog(level, message, detail);
  if (detail === undefined) {
    console.log(`${MAP_LOG_PREFIX} ${message}`);
    return;
  }
  if (level === 'error') {
    console.error(`${MAP_LOG_PREFIX} ${message}`, detail);
    return;
  }
  console.log(`${MAP_LOG_PREFIX} ${message}`, detail);
}

async function probeFailedTile(url: string) {
  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') ?? '';
    let bodyPreview = '';
    if (contentType.includes('image')) {
      bodyPreview = `[image body, ${response.headers.get('content-length') ?? 'unknown'} bytes]`;
    } else {
      bodyPreview = (await response.text()).slice(0, 240);
    }

    logMap(
      'Basemap tile probe',
      {
        url,
        status: response.status,
        statusText: response.statusText,
        contentType,
        bodyPreview,
      },
      'error'
    );
  } catch (error) {
    logMap(
      'Basemap tile probe request failed',
      {
        url,
        error: error instanceof Error ? error.message : String(error),
      },
      'error'
    );
  }
}

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
    onLoadStatusChange?: (status: MapLoadStatus) => void;
    onZoomChange?: (zoom: number) => void;
  }
): VanillaPartnerMapHandle {
  container.replaceChildren();

  let tilesLoaded = 0;
  let tilesFailed = 0;
  const errors: MapTileError[] = [];
  let loadStatus: MapLoadStatus = { ...INITIAL_MAP_LOAD_STATUS };

  const pushError = (error: MapTileError) => {
    errors.push(error);
    if (errors.length > 25) {
      errors.shift();
    }
  };

  const publishStatus = (phase: MapLoadStatus['phase']) => {
    loadStatus = {
      phase,
      tilesLoaded,
      tilesFailed,
      errors: [...errors],
    };
    options.onLoadStatusChange?.(loadStatus);
  };

  publishStatus('loading');
  logMap('Mounting map');

  const useNativeTouchPinch = prefersNativeTouchPinch();
  const useSmoothWheelZoom = prefersSmoothWheelZoom();
  const touchOptions = mobileMapInteractionOptions();

  const map = L.map(container, {
    scrollWheelZoom: false,
    smoothWheelZoom: useSmoothWheelZoom ? 'center' : false,
    smoothSensitivity: 1,
    worldCopyJump: true,
    zoomAnimation: true,
    fadeAnimation: true,
    zoomSnap: touchOptions.zoomSnap,
    zoomDelta: 0.5,
    bounceAtZoomLimits: false,
    dragging: true,
    touchZoom: 'center',
    doubleClickZoom: 'center',
    inertia: touchOptions.inertia,
    inertiaDeceleration: touchOptions.inertiaDeceleration,
    inertiaMaxSpeed: touchOptions.inertiaMaxSpeed,
    tapTolerance: touchOptions.tapTolerance,
  }).setView(WORLD_VIEW_CENTER, WORLD_VIEW_ZOOM);

  const removeMobileMapTouch = registerMobileMapTouch(map);
  const removePinchPanHandoff = useNativeTouchPinch ? registerPinchPanHandoff(map) : () => {};
  const removeTrackpadPinchZoom = useSmoothWheelZoom ? registerTrackpadPinchZoom(map) : () => {};

  const publishZoom = () => {
    options.onZoomChange?.(map.getZoom());
  };

  const tileLayer = createThrottledTileLayer(STANDARD_BASEMAP_URL, {
    maxZoom: 19,
    attribution: STANDARD_BASEMAP_ATTRIBUTION,
    updateWhenZooming: true,
    updateWhenIdle: true,
    keepBuffer: 2,
  }).addTo(map);

  const reportTileStatus = () => {
    if (tilesLoaded > 0) {
      publishStatus('rendered');
      return;
    }
    if (tilesFailed > 0) {
      publishStatus('failed');
    }
  };

  tileLayer.on('loading', () => {
    if (loadStatus.phase === 'loading') return;
    publishStatus('rendering');
    logMap('Basemap tiles loading');
  });

  tileLayer.on('tileload', (event) => {
    tilesLoaded += 1;
    if (tilesLoaded === 1) {
      logMap('First basemap tile loaded', { url: event.tile.src });
    }
    reportTileStatus();
  });

  tileLayer.on('tileerror', (event) => {
    tilesFailed += 1;
    const url = event.tile.src;
    pushError({
      url,
      at: new Date().toISOString(),
      message: 'Basemap tile failed to load',
    });
    logMap('Basemap tile failed', {
      url,
      loaded: tilesLoaded,
      failed: tilesFailed,
    }, 'error');
    if (tilesFailed === 1) {
      void probeFailedTile(url);
    }
    reportTileStatus();
  });

  tileLayer.on('load', () => {
    logMap('Visible basemap tiles finished loading', {
      loaded: tilesLoaded,
      failed: tilesFailed,
    });
    if (tilesLoaded > 0) {
      publishStatus('rendered');
      return;
    }
    reportTileStatus();
  });

  const tileFailureTimer = window.setTimeout(() => {
    if (loadStatus.phase === 'loading' || loadStatus.phase === 'rendering') {
      if (tilesLoaded === 0 && tilesFailed > 0) {
        pushError({
          url: STANDARD_BASEMAP_URL,
          at: new Date().toISOString(),
          message: 'No basemap tiles loaded within 8 seconds',
        });
        publishStatus('failed');
        logMap('No basemap tiles loaded after timeout', {
          loaded: tilesLoaded,
          failed: tilesFailed,
        }, 'error');
      }
    }
  }, 8000);

  const cluster = L.markerClusterGroup({
    chunkedLoading: true,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: DISABLE_CLUSTERING_AT_ZOOM,
    maxClusterRadius: (zoom) => clusterRadiusForZoom(zoom),
    iconCreateFunction: (c) => createClusterBubbleIcon(c.getChildCount()),
  }).addTo(map);

  const removeClusterZoomHandlers = attachPartnerPinClusterZoomHandlers(map, cluster);

  let placementMode = false;

  const onMapClick = (e: L.LeafletMouseEvent) => {
    if (!placementMode) return;
    options.onMapClick(e.latlng.lat, e.latlng.lng);
  };
  map.on('click', onMapClick);

  const onPopupClick = (e: MouseEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const link = target.closest('a.partner-pin-popup__link');
    if (link instanceof HTMLAnchorElement && link.href) {
      e.preventDefault();
      navigateTo(link.href);
      return;
    }

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

  map.whenReady(() => {
    publishStatus('rendering');
    publishZoom();
    logMap('Leaflet map ready', {
      center: map.getCenter(),
      zoom: map.getZoom(),
      tileUrl: STANDARD_BASEMAP_URL,
    });
    queueRemeasure();
  });

  map.on('zoom', publishZoom);
  map.on('zoomend', publishZoom);

  const panToPin = (lat: number, lng: number) => {
    panToPinView(map, lat, lng);
  };

  const syncPins = (pins: PartnerPin[], username: string | null) => {
    cluster.clearLayers();
    for (const pin of pins) {
      const isMine = !!username && pin.username === username;
      const marker = stampPartnerMarkerOrigin(
        L.marker([pin.lat, pin.lng], {
          icon: createPartnerPinIcon(isMine),
          riseOnHover: true,
        }),
        pin.lat,
        pin.lng
      );
      marker.bindPopup(buildPartnerPinPopupHtml(pin, isMine), {
        className: 'partner-pin-popup',
        maxWidth: 252,
        autoPan: false,
        offset: [0, -6],
      });
      marker.on('click', () => {
        if (placementMode) return;
        panToPin(pin.lat, pin.lng);
      });
      cluster.addLayer(marker);
    }
    cluster.refreshClusters();
    applyCoincidentPartnerPinSpread(cluster, map);
  };

  const setPlacementMode = (active: boolean) => {
    placementMode = active;
    container.classList.toggle('partner-map-root--placing', active);
  };

  const flyTo = (lat: number, lng: number, zoom = LOCATION_SEARCH_ZOOM) => {
    map.flyTo([lat, lng], zoom, { duration: 0.85 });
  };

  const destroy = () => {
    window.clearTimeout(tileFailureTimer);
    resizeObserver?.disconnect();
    removeClusterZoomHandlers();
    removeMobileMapTouch();
    removePinchPanHandoff();
    removeTrackpadPinchZoom();
    map.off('click', onMapClick);
    map.off('zoom', publishZoom);
    map.off('zoomend', publishZoom);
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
    flyTo,
    destroy,
  };
}
