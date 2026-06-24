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
    setSheetOpen(false);
    setDraft(null);
    setPlacementMode(false);
  }, []);

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
      closeSheet();
    }
  }, [closeSheet, createPin, draft]);

  const handleDeletePin = useCallback(
    async (pinId: string) => {
      await deletePin(pinId);
    },
    [deletePin]
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

      {error ? (
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

      {variant === 'splash' && onExpand ? (
        <div className="partner-app__expand-wrap">
          <button type="button" className="partner-app__expand" onClick={onExpand}>
            Open full view
          </button>
        </div>
      ) : null}

      <MyPinSheet
        open={myPinSheetOpen}
        pin={myPin}
        onClose={() => setMyPinSheetOpen(false)}
        onEdit={editMyPin}
      />

      <AddPinSheet
        open={sheetOpen}
        draft={draft}
        saving={saving}
        username={username}
        isUpdate={!!myPin}
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
      </footer>
    </div>
  );
}
