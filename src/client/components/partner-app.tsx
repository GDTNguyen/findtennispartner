import { useCallback, useState, type MouseEvent } from 'react';
import { navigateTo } from '@devvit/web/client';
import { AddPinSheet } from './add-pin-sheet';
import { createDraftFromPin, createEmptyDraft, type AddPinDraft } from './add-pin-draft';
import { MyPinSheet } from './my-pin-sheet';
import { PartnerMap } from './partner-map';
import { usePartnerPins } from '../hooks/usePartnerPins';
import { draftPartnerPost } from '../lib/draft-partner-post';

type PartnerAppProps = {
  variant?: 'splash' | 'game';
  onExpand?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function PartnerApp({ variant = 'game', onExpand }: PartnerAppProps) {
  const {
    pins,
    username,
    loading,
    saving,
    error,
    myPin,
    pinProfile,
    createPin,
    deletePin,
    clearError,
  } = usePartnerPins();

  const [placementMode, setPlacementMode] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [myPinSheetOpen, setMyPinSheetOpen] = useState(false);
  const [draft, setDraft] = useState<AddPinDraft | null>(null);
  const [posting, setPosting] = useState(false);

  const startPlacement = useCallback(() => {
    clearError();
    if (myPin) {
      setDraft(createDraftFromPin(myPin.lat, myPin.lng, myPin));
      setSheetOpen(true);
      setPlacementMode(false);
      return;
    }
    setPlacementMode(true);
    setSheetOpen(false);
    setDraft(null);
  }, [clearError, myPin]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!placementMode) return;
      if (myPin) {
        setDraft(createDraftFromPin(lat, lng, myPin));
      } else if (pinProfile) {
        setDraft(createDraftFromPin(lat, lng, pinProfile));
      } else {
        setDraft(createEmptyDraft(lat, lng));
      }
      setSheetOpen(true);
      setPlacementMode(false);
    },
    [myPin, pinProfile, placementMode]
  );

  const changePinLocation = useCallback(() => {
    setSheetOpen(false);
    setPlacementMode(true);
  }, []);

  const closeSheet = useCallback(() => {
    clearError();
    setSheetOpen(false);
    setDraft(null);
    setPlacementMode(false);
  }, [clearError]);

  const submitPin = useCallback(async () => {
    if (!draft) return;
    const ok = await createPin({
      lat: draft.lat,
      lng: draft.lng,
      utrLevel: draft.utrLevel,
      locationLabel: draft.locationLabel,
      socialLinks: draft.socialLinks,
    });
    if (ok) {
      clearError();
      closeSheet();
    }
  }, [clearError, closeSheet, createPin, draft]);

  const handleDeletePin = useCallback(
    async (pinId: string) => {
      const ok = await deletePin(pinId);
      if (ok) {
        clearError();
        setMyPinSheetOpen(false);
      }
      return ok;
    },
    [clearError, deletePin]
  );

  const handleDraftPost = useCallback(
    (pinId: string) => {
      const pin = pins.find((entry) => entry.id === pinId);
      if (!pin) return;
      setPosting(true);
      void draftPartnerPost(pin).finally(() => {
        setPosting(false);
      });
    },
    [pins]
  );

  const openMyPin = useCallback(() => {
    clearError();
    setMyPinSheetOpen(true);
  }, [clearError]);

  const editMyPin = useCallback(() => {
    setMyPinSheetOpen(false);
    startPlacement();
  }, [startPlacement]);

  const rootClassName =
    variant === 'splash' ? 'partner-app partner-app--splash' : 'partner-app';

  return (
    <div className={rootClassName}>
      <header className="partner-app__header">
        <div>
          <p className="partner-app__eyebrow">Find 10s Partner</p>
          <h1 className="partner-app__title">Hitting partner map</h1>
          <p className="partner-app__subtitle">
            Drop a pin where you play. Format:{' '}
            <strong>[UTR level, City/Court]</strong> plus your socials.
          </p>
        </div>
        <div className="partner-app__header-actions">
          {variant === 'splash' && onExpand ? (
            <button
              type="button"
              className="partner-app__expand-icon"
              onClick={onExpand}
              aria-label="Open full view"
            >
              <svg
                className="partner-app__expand-icon-svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 3H3v5" />
                <path d="M16 3h5v5" />
                <path d="M3 16v5h5" />
                <path d="M21 16v5h-5" />
                <path d="M3 8 8 3" />
                <path d="M16 3l5 5" />
                <path d="M3 16l5 5" />
                <path d="M21 16l-5 5" />
              </svg>
            </button>
          ) : null}
          {myPin ? (
            <button
              type="button"
              className="partner-app__secondary"
              onClick={openMyPin}
              disabled={loading || saving || posting}
            >
              My pin
            </button>
          ) : null}
          <button
            type="button"
            className="partner-app__cta"
            onClick={startPlacement}
            disabled={loading || saving || posting}
          >
            {myPin ? 'Update my pin' : 'Drop a pin'}
          </button>
        </div>
      </header>

      {error && !sheetOpen && !myPinSheetOpen ? (
        <p className="partner-app__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="partner-app__map-wrap">
        <PartnerMap
          pins={pins}
          username={username}
          placementMode={placementMode}
          onMapClick={handleMapClick}
          onDeletePin={handleDeletePin}
          onDraftPost={handleDraftPost}
        />
        {loading ? <div className="partner-app__map-loading">Loading pins…</div> : null}
      </div>

      <MyPinSheet
        key={myPin?.id ?? 'no-pin'}
        open={myPinSheetOpen}
        pin={myPin}
        deleting={saving}
        error={error}
        onClose={() => {
          clearError();
          setMyPinSheetOpen(false);
        }}
        onEdit={editMyPin}
        onDelete={() => {
          if (!myPin) return;
          void handleDeletePin(myPin.id);
        }}
      />

      <AddPinSheet
        open={sheetOpen}
        draft={draft}
        saving={saving}
        username={username}
        isUpdate={!!myPin}
        error={error}
        onChange={setDraft}
        onClose={closeSheet}
        onSubmit={() => void submitPin()}
        onChangeLocation={changePinLocation}
      />

      <footer className="partner-app__footer">
        <button
          type="button"
          className="partner-app__footer-link"
          onClick={() => navigateTo('https://challenge.allcourt.pro')}
        >
          AllCourtPro
        </button>
        <span className="partner-app__footer-sep">·</span>
        <button
          type="button"
          className="partner-app__footer-link"
          onClick={() => navigateTo('https://www.allcourt.pro/terms')}
        >
          Terms
        </button>
        <span className="partner-app__footer-sep">·</span>
        <button
          type="button"
          className="partner-app__footer-link"
          onClick={() => navigateTo('https://www.allcourt.pro/privacy')}
        >
          Privacy
        </button>
      </footer>
    </div>
  );
}
