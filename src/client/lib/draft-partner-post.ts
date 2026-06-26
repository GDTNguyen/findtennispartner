import type { CreatePartnerPostResponse, PartnerPin } from '../../shared/api';
import { pushAppToast } from './app-toast-bus';
import { openPartnerPostSheet } from './partner-post-sheet-bus';

const POST_LOG_PREFIX = '[find10spartner:post]';

function logPost(
  message: string,
  detail?: Record<string, unknown>,
  level: 'info' | 'error' = 'info'
): void {
  if (!detail) {
    if (level === 'error') console.error(`${POST_LOG_PREFIX} ${message}`);
    else console.log(`${POST_LOG_PREFIX} ${message}`);
    return;
  }
  if (level === 'error') console.error(`${POST_LOG_PREFIX} ${message}`, detail);
  else console.log(`${POST_LOG_PREFIX} ${message}`, detail);
}

function isCreatePartnerPostResponse(value: unknown): value is CreatePartnerPostResponse {
  if (typeof value !== 'object' || value === null) return false;
  if (!('type' in value) || value.type !== 'post-created') return false;
  if (!('postId' in value) || typeof value.postId !== 'string') return false;
  return true;
}

function errorMessageFromPayload(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!('status' in value) || value.status !== 'error') return null;
  if (!('message' in value) || typeof value.message !== 'string') return null;
  return value.message;
}

function toastPostSuccess(postId: string): void {
  pushAppToast({
    variant: 'success',
    text: 'Post published to the subreddit.',
  });
  logPost('Toast: success', { postId });
}

function toastPostError(reason: string): void {
  const text = `Couldn't post to subreddit: ${friendlyPostError(reason)}`;
  pushAppToast({
    variant: 'error',
    text,
  });
}

function friendlyPostError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('not approved') && lower.includes('run as user')) {
    return (
      'This app version is not approved to post as you in the Reddit mobile app yet. ' +
      'During playtest, only the app developer can post from mobile. Try reddit.com in a browser, ' +
      'or publish the app for review.'
    );
  }
  if (lower.includes('grpc') || lower.includes('status 2')) {
    return (
      'Reddit blocked posting as your account. Tap Post again and approve the permission prompt. ' +
      'If it keeps failing on mobile, try reddit.com in a browser.'
    );
  }
  return message;
}

export type SubmitPartnerPostResult =
  | { ok: true; postId: string }
  | { ok: false; reason: string };

/** Open the in-app review form for a hitting-partner thread. */
export function draftPartnerPost(pin: PartnerPin): void {
  logPost('Opening post form', { pinId: pin.id, username: pin.username });
  openPartnerPostSheet(pin);
}

/** Publish a reviewed hitting-partner thread to the subreddit. */
export async function submitPartnerPost(
  pin: PartnerPin,
  title: string,
  body: string
): Promise<SubmitPartnerPostResult> {
  logPost('Submitting post', { pinId: pin.id, titleLength: title.length, bodyLength: body.length });

  try {
    const res = await fetch('/api/posts/from-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinId: pin.id,
        title,
        text: body,
      }),
    });

    const data: unknown = await res.json().catch(() => {
      throw new Error(`Invalid server response (HTTP ${res.status})`);
    });
    if (!res.ok) {
      throw new Error(errorMessageFromPayload(data) ?? `HTTP ${res.status}`);
    }

    const apiError = errorMessageFromPayload(data);
    if (apiError) {
      throw new Error(apiError);
    }

    if (!isCreatePartnerPostResponse(data)) {
      throw new Error('Unexpected response from server');
    }

    logPost('Post created', { pinId: pin.id, postId: data.postId });
    toastPostSuccess(data.postId);
    return { ok: true, postId: data.postId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create post';
    logPost(
      'Post failed',
      {
        pinId: pin.id,
        reason: message,
        ...(err instanceof Error && err.cause ? { cause: String(err.cause) } : {}),
      },
      'error'
    );
    toastPostError(message);
    return { ok: false, reason: friendlyPostError(message) };
  }
}
