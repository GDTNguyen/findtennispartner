import { useCallback, useState } from 'react';
import { navigateTo } from '@devvit/web/client';
import { AddPinSheet } from './add-pin-sheet';
import { AppToastHost } from './app-toast';
import { PartnerPostSheetHost } from './partner-post-sheet';
import { createDraftFromPin, createEmptyDraft, type AddPinDraft } from './add-pin-draft';
import { MyPinSheet } from './my-pin-sheet';
import { PartnerMap } from './partner-map';
import { useDevvitPresentation } from '../hooks/useDevvitPresentation';
import { usePartnerPins } from '../hooks/usePartnerPins';
import { draftPartnerPost } from '../lib/draft-partner-post';

export function PartnerApp() {
  useDevvitPresentation();

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
      draftPartnerPost(pin);
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

  const rootClassName = 'partner-app partner-app--expanded';

  return (
    <div className={rootClassName}>
      <AppToastHost />
      <PartnerPostSheetHost />
      <header className="partner-app__header">
        <div className="partner-app__header-copy">
          <p className="partner-app__eyebrow">Find 10s Partner</p>
          <h1 className="partner-app__title">Hitting partner map</h1>
          <p className="partner-app__subtitle">
            Drop a pin where you play.
            <span className="partner-app__subtitle-detail">
              {' '}
              Format: <strong>[UTR level, City/Court]</strong> plus your socials.
            </span>
          </p>
        </div>
        <div className="partner-app__header-actions">
          {myPin ? (
            <button
              type="button"
              className="partner-app__secondary"
              onClick={openMyPin}
              disabled={loading || saving}
            >
              <span className="partner-app__secondary-label partner-app__secondary-label--full">
                My pin
              </span>
              <span className="partner-app__secondary-label partner-app__secondary-label--short">
                Pin
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className="partner-app__cta"
            onClick={startPlacement}
            disabled={loading || saving}
          >
            <span className="partner-app__cta-label partner-app__cta-label--full">
              {myPin ? 'Update my pin' : 'Drop a pin'}
            </span>
            <span className="partner-app__cta-label partner-app__cta-label--short">
              {myPin ? 'Update pin' : 'Drop pin'}
            </span>
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
