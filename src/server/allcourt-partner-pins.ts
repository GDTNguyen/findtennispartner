import type { PartnerPin } from '../shared/api';

const DEFAULT_ALLCOURT_ORIGIN = 'https://www.allcourt.pro';

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

function partnerPinsSecret(): string | null {
  const secret = process.env.ALLCOURT_PARTNER_PINS_SECRET?.trim();
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

export async function syncPartnerPinToAllCourt(
  pin: PartnerPin,
  postId: string,
  subredditName: string | undefined
): Promise<void> {
  const secret = partnerPinsSecret();
  if (!secret) {
    console.warn('[allcourt] ALLCOURT_PARTNER_PINS_SECRET not set — skipping pin sync');
    return;
  }

  const url = `${allcourtApiOrigin()}/api/reddit/partner-pins`;

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
  } catch (error) {
    if (isDomainNotAllowedError(error)) {
      console.warn('[allcourt] HTTP fetch blocked — pin saved in Redis only');
      return;
    }
    console.error('[allcourt] Failed to sync partner pin:', error);
  }
}

export async function deletePartnerPinFromAllCourt(pinId: string): Promise<void> {
  const secret = partnerPinsSecret();
  if (!secret) return;

  const url = `${allcourtApiOrigin()}/api/reddit/partner-pins?id=${encodeURIComponent(pinId)}`;

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
  } catch (error) {
    if (isDomainNotAllowedError(error)) {
      console.warn('[allcourt] HTTP fetch blocked — pin removed from Redis only');
      return;
    }
    console.error('[allcourt] Failed to delete partner pin:', error);
  }
}
