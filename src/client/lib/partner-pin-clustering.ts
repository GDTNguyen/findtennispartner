import L from 'leaflet';
import { CLUSTER_RADIUS_PX, DISABLE_CLUSTERING_AT_ZOOM } from './map-constants';

type PartnerMarkerWithOrig = L.Marker & { __f10pOrigLatLng: L.LatLng };

const SPREAD_ANIM_MS = 340;
const spreadAnimGen = { n: 0 };

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Wider clusters when zoomed out; tighter as you zoom in. */
export function clusterRadiusForZoom(zoom: number): number {
  const z = Math.round(zoom);
  if (z >= DISABLE_CLUSTERING_AT_ZOOM) return 0;
  if (z <= 4) return 88;
  if (z <= 7) return 72;
  if (z <= 10) return 60;
  return CLUSTER_RADIUS_PX;
}

function offsetLatLngByMeters(from: L.LatLng, distanceM: number, bearingDeg: number): L.LatLng {
  const δ = distanceM / 6378137;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (from.lat * Math.PI) / 180;
  const λ1 = (from.lng * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  let lngDeg = (λ2 * 180) / Math.PI;
  lngDeg = ((lngDeg + 540) % 360) - 180;
  return L.latLng((φ2 * 180) / Math.PI, lngDeg);
}

/**
 * When clustering is off, pins at identical coords stack in one pixel.
 * Spread them in a ring so each stays clickable; restore true coords when zoomed back out.
 */
export function applyCoincidentPartnerPinSpread(cluster: L.MarkerClusterGroup, map: L.Map): void {
  const zRound = Math.round(map.getZoom());
  const targets = new Map<PartnerMarkerWithOrig, L.LatLng>();

  if (zRound < DISABLE_CLUSTERING_AT_ZOOM) {
    cluster.eachLayer((layer) => {
      if (!(layer instanceof L.Marker)) return;
      const marker = layer as PartnerMarkerWithOrig;
      if (marker.__f10pOrigLatLng) targets.set(marker, marker.__f10pOrigLatLng);
    });
  } else {
    const ringMeters = Math.max(14, 11 + (zRound - DISABLE_CLUSTERING_AT_ZOOM) * 7);
    const groups = new Map<string, PartnerMarkerWithOrig[]>();

    cluster.eachLayer((layer) => {
      if (!(layer instanceof L.Marker)) return;
      const marker = layer as PartnerMarkerWithOrig;
      const origin = marker.__f10pOrigLatLng;
      if (!origin) return;
      const key = `${origin.lat.toFixed(7)},${origin.lng.toFixed(7)}`;
      const list = groups.get(key) ?? [];
      list.push(marker);
      groups.set(key, list);
    });

    for (const list of groups.values()) {
      const first = list[0];
      if (!first) continue;
      if (list.length < 2) {
        targets.set(first, first.__f10pOrigLatLng);
        continue;
      }
      const center = first.__f10pOrigLatLng;
      const n = list.length;
      for (let i = 0; i < n; i++) {
        const marker = list[i];
        if (!marker) continue;
        const bearingDeg = (360 * i) / n;
        targets.set(marker, offsetLatLngByMeters(center, ringMeters, bearingDeg));
      }
    }
  }

  if (targets.size === 0) return;

  let maxDelta = 0;
  for (const [marker, to] of targets) {
    const from = marker.getLatLng();
    maxDelta = Math.max(maxDelta, Math.abs(to.lat - from.lat), Math.abs(to.lng - from.lng));
  }
  if (maxDelta < 1e-12) return;

  const myGen = ++spreadAnimGen.n;
  const fromSnapshot = new Map<PartnerMarkerWithOrig, L.LatLng>();
  for (const marker of targets.keys()) {
    fromSnapshot.set(marker, marker.getLatLng());
  }

  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const tick = (now: number) => {
    if (myGen !== spreadAnimGen.n) return;
    const elapsed = now - start;
    const t = Math.min(1, elapsed / SPREAD_ANIM_MS);
    const eased = easeOutCubic(t);
    for (const [marker, to] of targets) {
      const from = fromSnapshot.get(marker);
      if (!from) continue;
      marker.setLatLng(
        L.latLng(from.lat + (to.lat - from.lat) * eased, from.lng + (to.lng - from.lng) * eased)
      );
    }
    if (t < 1) {
      requestAnimationFrame(tick);
      return;
    }
    for (const [marker, to] of targets) {
      marker.setLatLng(to);
    }
  };
  requestAnimationFrame(tick);
}

export function attachPartnerPinClusterZoomHandlers(
  map: L.Map,
  cluster: L.MarkerClusterGroup
): () => void {
  const onZoomEnd = () => {
    cluster.refreshClusters();
    applyCoincidentPartnerPinSpread(cluster, map);
  };

  const onZoomAnimRestoreOrigins = (event: L.ZoomAnimEvent) => {
    if (event.zoom >= DISABLE_CLUSTERING_AT_ZOOM) return;
    spreadAnimGen.n += 1;
    cluster.eachLayer((layer) => {
      if (!(layer instanceof L.Marker)) return;
      const marker = layer as PartnerMarkerWithOrig;
      const origin = marker.__f10pOrigLatLng;
      if (!origin) return;
      const current = marker.getLatLng();
      if (Math.abs(current.lat - origin.lat) < 1e-10 && Math.abs(current.lng - origin.lng) < 1e-10) return;
      marker.setLatLng(origin);
    });
  };

  map.on('zoomend', onZoomEnd);
  map.on('zoomanim', onZoomAnimRestoreOrigins);

  return () => {
    map.off('zoomend', onZoomEnd);
    map.off('zoomanim', onZoomAnimRestoreOrigins);
  };
}

export function stampPartnerMarkerOrigin(marker: L.Marker, lat: number, lng: number): PartnerMarkerWithOrig {
  const stamped = marker as PartnerMarkerWithOrig;
  stamped.__f10pOrigLatLng = L.latLng(lat, lng);
  return stamped;
}
