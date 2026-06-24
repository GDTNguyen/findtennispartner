import { useEffect, useRef } from 'react';
import type { PartnerPin } from '../../shared/api';
import { mountVanillaPartnerMap, type VanillaPartnerMapHandle } from '../lib/vanilla-partner-map';

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

  return (
    <div className="partner-map-shell">
      <div ref={containerRef} className="partner-map-root" />
      {placementMode ? (
        <div className="partner-map-placement-hint">Tap the map to place your pin</div>
      ) : null}
    </div>
  );
}
