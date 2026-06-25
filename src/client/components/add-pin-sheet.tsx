import { useState } from 'react';
import { navigateTo } from '@devvit/web/client';
import { formatPartnerPinLabel } from '../../shared/api';
import type { AddPinDraft } from './add-pin-draft';

type AddPinSheetProps = {
  open: boolean;
  draft: AddPinDraft | null;
  saving: boolean;
  username: string | null;
  isUpdate: boolean;
  error: string | null;
  onChange: (draft: AddPinDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
  onChangeLocation: () => void;
};

type AddPinSheetFormProps = Omit<AddPinSheetProps, 'open' | 'draft'> & {
  draft: AddPinDraft;
};

export function AddPinSheet(props: AddPinSheetProps) {
  const { open, draft } = props;
  if (!open || !draft) return null;

  return <AddPinSheetForm {...props} draft={draft} />;
}

function AddPinSheetForm({
  draft,
  saving,
  username,
  isUpdate,
  error,
  onChange,
  onClose,
  onSubmit,
  onChangeLocation,
}: AddPinSheetFormProps) {
  const [consent, setConsent] = useState(false);

  const preview =
    !draft.utrLevel.trim() || !draft.locationLabel.trim()
      ? '[UTR level, City/Court]'
      : formatPartnerPinLabel(draft.utrLevel, draft.locationLabel);

  const signedIn = !!username && username !== 'anonymous';

  return (
    <div className="partner-pin-sheet" role="dialog" aria-modal="true" aria-labelledby="add-pin-title">
      <div className="partner-pin-sheet__backdrop" onClick={onClose} />
      <div className="partner-pin-sheet__panel">
        <div className="partner-pin-sheet__header">
          <div>
            <p className="partner-pin-sheet__eyebrow">Looking for a hitting partner?</p>
            <h2 id="add-pin-title" className="partner-pin-sheet__title">
              Drop your pin
            </h2>
          </div>
          <button type="button" className="partner-pin-sheet__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error ? (
          <p className="partner-pin-sheet__error" role="alert">
            {error}
          </p>
        ) : null}

        {!signedIn ? (
          <p className="partner-pin-sheet__notice">
            Sign in to Reddit to post your pin on the map.
          </p>
        ) : null}

        <p className="partner-pin-sheet__hint">
          Post using this format: <strong>[UTR level, City/Court]</strong> — e.g.{' '}
          <strong>[4.0, Bardon Courts, Brisbane]</strong>
        </p>

        <label className="partner-pin-sheet__field">
          <span>UTR level</span>
          <input
            type="text"
            placeholder="4.0"
            value={draft.utrLevel}
            onChange={(e) => onChange({ ...draft, utrLevel: e.target.value })}
          />
        </label>

        <label className="partner-pin-sheet__field">
          <span>City / court</span>
          <input
            type="text"
            placeholder="Bardon Courts, Brisbane"
            value={draft.locationLabel}
            onChange={(e) => onChange({ ...draft, locationLabel: e.target.value })}
          />
        </label>

        <p className="partner-pin-sheet__preview">{preview}</p>

        <button type="button" className="partner-pin-sheet__location" onClick={onChangeLocation}>
          Change location on map
        </button>

        <fieldset className="partner-pin-sheet__fieldset">
          <legend>Profile / social links</legend>
          <label className="partner-pin-sheet__field">
            <span>Instagram</span>
            <input
              type="url"
              placeholder="https://instagram.com/you"
              value={draft.socialLinks.instagram ?? ''}
              onChange={(e) =>
                onChange({
                  ...draft,
                  socialLinks: { ...draft.socialLinks, instagram: e.target.value },
                })
              }
            />
          </label>
          <label className="partner-pin-sheet__field">
            <span>X (Twitter)</span>
            <input
              type="url"
              placeholder="https://x.com/you"
              value={draft.socialLinks.x ?? ''}
              onChange={(e) =>
                onChange({
                  ...draft,
                  socialLinks: { ...draft.socialLinks, x: e.target.value },
                })
              }
            />
          </label>
          <label className="partner-pin-sheet__field">
            <span>Facebook</span>
            <input
              type="url"
              placeholder="https://facebook.com/you"
              value={draft.socialLinks.facebook ?? ''}
              onChange={(e) =>
                onChange({
                  ...draft,
                  socialLinks: { ...draft.socialLinks, facebook: e.target.value },
                })
              }
            />
          </label>
          <label className="partner-pin-sheet__field">
            <span>AllCourtPro profile</span>
            <input
              type="url"
              placeholder="https://www.allcourt.pro/..."
              value={draft.socialLinks.allcourt ?? ''}
              onChange={(e) =>
                onChange({
                  ...draft,
                  socialLinks: { ...draft.socialLinks, allcourt: e.target.value },
                })
              }
            />
          </label>
          <label className="partner-pin-sheet__field">
            <span>Other link</span>
            <input
              type="url"
              placeholder="Any other profile URL"
              value={draft.socialLinks.other ?? ''}
              onChange={(e) =>
                onChange({
                  ...draft,
                  socialLinks: { ...draft.socialLinks, other: e.target.value },
                })
              }
            />
          </label>
        </fieldset>

        <label className="partner-pin-sheet__consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I understand my Reddit username, chosen map location, level and any
            links I add will be shown publicly and stored by AllCourtPro so my
            pin persists across posts. I can remove my pin anytime. See the{' '}
            <button
              type="button"
              className="partner-pin-sheet__inline-link"
              onClick={() => navigateTo('https://www.allcourt.pro/terms')}
            >
              Terms
            </button>{' '}
            and{' '}
            <button
              type="button"
              className="partner-pin-sheet__inline-link"
              onClick={() => navigateTo('https://www.allcourt.pro/privacy')}
            >
              Privacy policy
            </button>
            .
          </span>
        </label>

        <div className="partner-pin-sheet__actions">
          <button type="button" className="partner-pin-sheet__secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="partner-pin-sheet__primary"
            disabled={!signedIn || !consent || saving}
            onClick={onSubmit}
          >
            {saving ? 'Posting…' : isUpdate ? 'Update pin' : 'Post pin'}
          </button>
        </div>
      </div>
    </div>
  );
}
