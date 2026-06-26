import { useCallback, useRef, type MouseEvent } from 'react';
import { PartnerMap } from './partner-map';
import { useInlineFeedScrollPassthrough } from '../hooks/useInlineFeedScrollPassthrough';
import { usePartnerPins } from '../hooks/usePartnerPins';

type PartnerInlinePreviewProps = {
  onExpand: (event: MouseEvent<HTMLElement>) => void;
};

export function PartnerInlinePreview({ onExpand }: PartnerInlinePreviewProps) {
  useInlineFeedScrollPassthrough();

  const { pins, username, loading } = usePartnerPins();
  const expandRequestedRef = useRef(false);

  const handleActivate = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (expandRequestedRef.current) return;
      expandRequestedRef.current = true;
      event.preventDefault();
      event.stopPropagation();
      onExpand(event);
    },
    [onExpand]
  );

  return (
    <div
      className="partner-app partner-app--splash"
      role="button"
      tabIndex={0}
      aria-label="Open hitting partner map"
      onClick={handleActivate}
    >
      <header className="partner-app__header partner-app__header--inline">
        <div className="partner-app__header-copy">
          <p className="partner-app__eyebrow">Find 10s Partner</p>
          <h1 className="partner-app__title">Hitting partner map</h1>
          <p className="partner-app__subtitle partner-app__subtitle--inline">
            {loading
              ? 'Loading pins…'
              : `${pins.length} player${pins.length === 1 ? '' : 's'} on the map`}
          </p>
        </div>
      </header>

      <div className="partner-app__map-wrap">
        <PartnerMap
          pins={pins}
          username={username}
          placementMode={false}
          previewMode
          onMapClick={() => {}}
          onDeletePin={() => {}}
          onDraftPost={() => {}}
        />
        <div className="partner-app__inline-overlay" aria-hidden="true">
          <span className="partner-app__inline-cta">Tap to open map</span>
        </div>
      </div>
    </div>
  );
}
