import { useEffect, useState, type MouseEvent } from 'react';
import type { PartnerPin } from '../../shared/api';
import { buildPartnerPostBody, buildPartnerPostTitle } from '../../shared/api';
import { closePartnerPostSheet, subscribePartnerPostSheet } from '../lib/partner-post-sheet-bus';
import { submitPartnerPost } from '../lib/draft-partner-post';
import { requestUserPostPermission } from '../lib/request-user-post-permission';

export function PartnerPostSheetHost() {
  const [pin, setPin] = useState<PartnerPin | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribePartnerPostSheet((nextPin) => {
      setPin(nextPin);
      setSubmitting(false);
      setError(null);
      if (nextPin) {
        setTitle(buildPartnerPostTitle(nextPin));
        setBody(buildPartnerPostBody(nextPin));
      } else {
        setTitle('');
        setBody('');
      }
    });
  }, []);

  if (!pin) return null;

  const handleClose = () => {
    if (submitting) return;
    closePartnerPostSheet();
  };

  const handleSubmit = (event: MouseEvent<HTMLButtonElement>) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required');
      return;
    }

    setError(null);
    setSubmitting(true);
    void (async () => {
      const permission = await requestUserPostPermission(event.nativeEvent);
      if (!permission.ok) {
        setError(permission.reason);
        setSubmitting(false);
        return;
      }

      const result = await submitPartnerPost(pin, trimmedTitle, body);
      if (result.ok) {
        closePartnerPostSheet();
        return;
      }
      setError(result.reason);
      setSubmitting(false);
    })();
  };

  return (
    <div
      className="partner-post-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-post-sheet-title"
    >
      <button
        type="button"
        className="partner-pin-sheet__backdrop"
        onClick={handleClose}
        aria-label="Close"
      />
      <div className="partner-pin-sheet__panel partner-post-sheet__panel">
        <header className="partner-pin-sheet__header">
          <div>
            <p className="partner-pin-sheet__eyebrow">Share your pin</p>
            <h2 id="partner-post-sheet-title" className="partner-pin-sheet__title">
              Post to subreddit
            </h2>
          </div>
          <button
            type="button"
            className="partner-pin-sheet__close"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <p className="partner-pin-sheet__hint">
          Edit the title and body, then publish your hitting partner post.
        </p>

        <label className="partner-pin-sheet__field">
          <span>Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            required
          />
        </label>

        <label className="partner-pin-sheet__field">
          <span>Body (markdown)</span>
          <textarea
            className="partner-post-sheet__textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={submitting}
            rows={12}
          />
        </label>

        {error ? (
          <p className="partner-pin-sheet__error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="partner-pin-sheet__actions">
          <button
            type="button"
            className="partner-pin-sheet__secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="partner-pin-sheet__primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </footer>
      </div>
    </div>
  );
}
