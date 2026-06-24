import { settings } from '@devvit/web/server';
import type { PartnerPin } from '../shared/api';

const DEFAULT_ALLCOURT_ORIGIN = 'https://www.allcourt.pro';
const PARTNER_PINS_SECRET_SETTING = 'allcourt-partner-pins-secret';

function allcourtApiOrigin(): string {
  const raw = process.env.ALLCOURT_API_ORIGIN?.trim().replace(/\/$/, '');
  if (!raw) return DEFAULT_ALLCOURT_ORIGIN;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return DEFAULT_ALLCOURT_ORIGIN;
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return DEFAULT_ALLCOURT_ORIGIN;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_ALLCOURT_ORIGIN;
  }
}

async function partnerPinsSecret(): Promise<string | null> {
  const fromSettings = await settings.get<string>(PARTNER_PINS_SECRET_SETTING);
  const fromEnv = process.env.ALLCOURT_PARTNER_PINS_SECRET?.trim();
  const secret = (typeof fromSettings === 'string' ? fromSettings : fromEnv)?.trim();
  return secret && secret.length > 0 ? secret : null;
}

function isDomainNotAllowedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('PERMISSION_DENIED') ||
    message.includes('not allowed') ||
    message.includes('not allow-listed')
  );
}

function syncContext(pin: PartnerPin, postId: string) {
  return {
    pinId: pin.id,
    redditUsername: pin.username,
    redditPostId: postId,
  };
}

export async function syncPartnerPinToAllCourt(
  pin: PartnerPin,
  postId: string,
  subredditName: string | undefined
): Promise<void> {
  const secret = await partnerPinsSecret();
  const context = syncContext(pin, postId);

  if (!secret) {
    console.warn(
      '[allcourt] Supabase sync skipped — allcourt-partner-pins-secret not set (run: devvit settings set allcourt-partner-pins-secret)',
      context
    );
    return;
  }

  const url = `${allcourtApiOrigin()}/api/reddit/partner-pins`;
  console.log('[allcourt] Syncing partner pin to Supabase via AllCourt API', {
    ...context,
    url,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        id: pin.id,
        redditPostId: postId,
        redditUsername: pin.username,
        redditSubreddit: subredditName ?? null,
        lat: pin.lat,
        lng: pin.lng,
        utrLevel: pin.utrLevel,
        locationLabel: pin.locationLabel,
        socialLinks: pin.socialLinks,
        pinnedAt: pin.createdAt,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AllCourt API returned HTTP ${res.status}${text ? `: ${text}` : ''}`);
    }

    const payload = (await res.json().catch(() => null)) as { ok?: boolean; pin?: { id?: string } } | null;
    console.log('[allcourt] Supabase sync succeeded', {
      ...context,
      httpStatus: res.status,
      supabasePinId: payload?.pin?.id ?? pin.id,
    });
  } catch (error) {
    if (isDomainNotAllowedError(error)) {
      console.warn('[allcourt] Supabase sync failed — HTTP fetch blocked (pin saved in Redis only)', {
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    console.error('[allcourt] Supabase sync failed', {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function deletePartnerPinFromAllCourt(pinId: string): Promise<void> {
  const secret = await partnerPinsSecret();
  const context = { pinId };

  if (!secret) {
    console.warn(
      '[allcourt] Supabase delete skipped — allcourt-partner-pins-secret not set (run: devvit settings set allcourt-partner-pins-secret)',
      context
    );
    return;
  }

  const url = `${allcourtApiOrigin()}/api/reddit/partner-pins?id=${encodeURIComponent(pinId)}`;
  console.log('[allcourt] Deleting partner pin from Supabase via AllCourt API', { ...context, url });

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      throw new Error(`AllCourt API returned HTTP ${res.status}${text ? `: ${text}` : ''}`);
    }

    console.log('[allcourt] Supabase delete succeeded', {
      ...context,
      httpStatus: res.status,
    });
  } catch (error) {
    if (isDomainNotAllowedError(error)) {
      console.warn('[allcourt] Supabase delete failed — HTTP fetch blocked (pin removed from Redis only)', {
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    console.error('[allcourt] Supabase delete failed', {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
