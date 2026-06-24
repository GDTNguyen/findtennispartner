import { useCallback, useState } from 'react';
import type { PartnerPin } from '../../shared/api';
import { formatPartnerPinLabel } from '../../shared/api';
import { draftPartnerPost } from '../lib/draft-partner-post';

type MyPinSheetProps = {
  open: boolean;
  pin: PartnerPin | null;
  onClose: () => void;
  onEdit: () => void;
};

export function MyPinSheet({ open, pin, onClose, onEdit }: MyPinSheetProps) {
  const [posting, setPosting] = useState(false);

  const handlePost = useCallback(() => {
    if (!pin) return;
    setPosting(true);
    void draftPartnerPost(pin).finally(() => {
      setPosting(false);
    });
  }, [pin]);

  if (!open || !pin) return null;

  const label = formatPartnerPinLabel(pin.utrLevel, pin.locationLabel);
  const links = [
    ['Instagram', pin.socialLinks.instagram],
    ['X', pin.socialLinks.x],
    ['Facebook', pin.socialLinks.facebook],
    ['AllCourtPro', pin.socialLinks.allcourt],
    ['Profile', pin.socialLinks.other],
  ].filter((entry): entry is [string, string] => !!entry[1]);

  return (
    <div className="partner-pin-sheet" role="dialog" aria-modal="true" aria-label="My pin">
      <button type="button" className="partner-pin-sheet__backdrop" onClick={onClose} />
      <div className="partner-pin-sheet__panel">
        <header className="partner-pin-sheet__header">
          <h2 className="partner-pin-sheet__title">My pin</h2>
          <button type="button" className="partner-pin-sheet__close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="partner-pin-sheet__body">
          <p className="partner-pin-sheet__label">{label}</p>
          <p className="partner-pin-sheet__meta">
            u/{pin.username} · {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
          </p>

          {links.length > 0 ? (
            <ul className="partner-pin-sheet__links">
              {links.map(([name, href]) => (
                <li key={name}>
                  <span>{name}</span> {href}
                </li>
              ))}
            </ul>
          ) : (
            <p className="partner-pin-sheet__hint">Add social links when you edit your pin.</p>
          )}

          <p className="partner-pin-sheet__hint">
            Post to the subreddit so others can find you. You can review the title and body before
            publishing.
          </p>
        </div>

        <footer className="partner-pin-sheet__actions">
          <button
            type="button"
            className="partner-pin-sheet__post"
            disabled={posting}
            onClick={handlePost}
          >
            {posting ? 'Opening…' : 'Post to subreddit'}
          </button>
          <button type="button" className="partner-pin-sheet__secondary" onClick={onEdit}>
            Edit pin
          </button>
        </footer>
      </div>
    </div>
  );
}
