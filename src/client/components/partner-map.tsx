import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeocodeSearchHit, PartnerPin } from '../../shared/api';
import { LOCATION_SEARCH_ZOOM } from '../lib/map-constants';
import {
  INITIAL_MAP_LOAD_STATUS,
  mapLoadStatusLabel,
  mapLoadStatusTone,
  type MapLoadStatus,
} from '../lib/map-load-status';
import { mountVanillaPartnerMap, type VanillaPartnerMapHandle } from '../lib/vanilla-partner-map';
import { LocationSearch } from './location-search';

type PartnerMapProps = {
  pins: PartnerPin[];
  username: string | null;
  placementMode: boolean;
  onMapClick: (lat: number, lng: number) => void;
  onDeletePin: (pinId: string) => void;
  onDraftPost: (pinId: string) => void;
};

export function PartnerMap({
  pins,
  username,
  placementMode,
  onMapClick,
  onDeletePin,
  onDraftPost,
}: PartnerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapHandleRef = useRef<VanillaPartnerMapHandle | null>(null);
  const [mapLoadStatus, setMapLoadStatus] = useState<MapLoadStatus>(INITIAL_MAP_LOAD_STATUS);
  const [mapZoom, setMapZoom] = useState<number | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const onDeletePinRef = useRef(onDeletePin);
  const onDraftPostRef = useRef(onDraftPost);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onDeletePinRef.current = onDeletePin;
  }, [onDeletePin]);

  useEffect(() => {
    onDraftPostRef.current = onDraftPost;
  }, [onDraftPost]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapHandleRef.current) return;

    mapHandleRef.current = mountVanillaPartnerMap(el, {
      onMapClick: (lat, lng) => onMapClickRef.current(lat, lng),
      onDeletePin: (pinId) => onDeletePinRef.current(pinId),
      onDraftPost: (pinId) => onDraftPostRef.current(pinId),
      onLoadStatusChange: setMapLoadStatus,
      onZoomChange: setMapZoom,
    });

    return () => {
      mapHandleRef.current?.destroy();
      mapHandleRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapHandleRef.current?.setPlacementMode(placementMode);
  }, [placementMode]);

  useEffect(() => {
    mapHandleRef.current?.syncPins(pins, username);
  }, [pins, username]);

  const handleLocationSelect = useCallback((hit: GeocodeSearchHit) => {
    const lat = Number.parseFloat(hit.lat);
    const lng = Number.parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    mapHandleRef.current?.flyTo(lat, lng, LOCATION_SEARCH_ZOOM);
  }, []);

  const mapLoadTone = mapLoadStatusTone(mapLoadStatus);

  return (
    <div className="partner-map-shell">
      <LocationSearch onSelect={handleLocationSelect} />
      <div ref={containerRef} className="partner-map-root" />
      {mapZoom !== null ? <div className="partner-map-zoom-badge">Zoom {mapZoom}</div> : null}
      <div
        className={`partner-map-load-status partner-map-load-status--${mapLoadTone}`}
        role="status"
        aria-live="polite"
      >
        {mapLoadStatusLabel(mapLoadStatus)}
      </div>
      {placementMode ? (
        <div className="partner-map-placement-hint">Tap the map to place your pin</div>
      ) : null}
    </div>
  );
}
