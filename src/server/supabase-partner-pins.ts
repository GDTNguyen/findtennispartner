import { settings } from '@devvit/web/server';
import type { PartnerPin } from '../shared/api';

const SUPABASE_HOST = 'amspslqidldfolaborfi.supabase.co';
const SUPABASE_REST_BASE = `https://${SUPABASE_HOST}/rest/v1`;
const PARTNER_PINS_TABLE = 'reddit_partner_pins';
const SERVICE_ROLE_KEY_SETTING = 'supabase-service-role-key';

async function supabaseServiceRoleKey(): Promise<string | null> {
  const fromSettings = await settings.get<string>(SERVICE_ROLE_KEY_SETTING);
  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key = (typeof fromSettings === 'string' ? fromSettings : fromEnv)?.trim();
  return key && key.length > 0 ? key : null;
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

function supabaseHeaders(key: string, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

function sanitizeSocialLinks(raw: PartnerPin['socialLinks']): PartnerPin['socialLinks'] {
  const trim = (value: string | undefined) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  return {
    instagram: trim(raw.instagram),
    x: trim(raw.x),
    facebook: trim(raw.facebook),
    allcourt: trim(raw.allcourt),
    other: trim(raw.other),
  };
}

function partnerPinRow(
  pin: PartnerPin,
  postId: string,
  subredditName: string | undefined
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: pin.id,
    reddit_post_id: postId,
    reddit_username: pin.username,
    reddit_subreddit: subredditName?.trim() || null,
    lat: pin.lat,
    lng: pin.lng,
    utr_level: pin.utrLevel.trim(),
    location_label: pin.locationLabel.trim(),
    social_links: sanitizeSocialLinks(pin.socialLinks),
    pinned_at: pin.createdAt,
    updated_at: now,
  };
}

export async function syncPartnerPinToSupabase(
  pin: PartnerPin,
  postId: string,
  subredditName: string | undefined
): Promise<void> {
  const key = await supabaseServiceRoleKey();
  const context = syncContext(pin, postId);

  if (!key) {
    console.warn(
      '[supabase] Pin sync skipped — supabase-service-role-key not set (run: devvit settings set supabase-service-role-key)',
      context
    );
    return;
  }

  const url = `${SUPABASE_REST_BASE}/${PARTNER_PINS_TABLE}?on_conflict=reddit_post_id,reddit_username`;
  console.log('[supabase] Upserting partner pin via PostgREST', { ...context, url });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: supabaseHeaders(key, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify(partnerPinRow(pin, postId, subredditName)),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PostgREST returned HTTP ${res.status}${text ? `: ${text}` : ''}`);
    }

    const rows = (await res.json().catch(() => null)) as Array<{ id?: string }> | null;
    console.log('[supabase] Pin upsert succeeded', {
      ...context,
      httpStatus: res.status,
      supabasePinId: rows?.[0]?.id ?? pin.id,
    });
  } catch (error) {
    if (isDomainNotAllowedError(error)) {
      console.warn('[supabase] Pin sync failed — HTTP fetch blocked (pin saved in Redis only)', {
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    console.error('[supabase] Pin sync failed', {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function deletePartnerPinFromSupabase(pinId: string): Promise<void> {
  const key = await supabaseServiceRoleKey();
  const context = { pinId };

  if (!key) {
    console.warn(
      '[supabase] Pin delete skipped — supabase-service-role-key not set (run: devvit settings set supabase-service-role-key)',
      context
    );
    return;
  }

  const url = `${SUPABASE_REST_BASE}/${PARTNER_PINS_TABLE}?id=eq.${encodeURIComponent(pinId)}`;
  console.log('[supabase] Deleting partner pin via PostgREST', { ...context, url });

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: supabaseHeaders(key, {
        Prefer: 'return=representation',
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      throw new Error(`PostgREST returned HTTP ${res.status}${text ? `: ${text}` : ''}`);
    }

    console.log('[supabase] Pin delete succeeded', {
      ...context,
      httpStatus: res.status,
    });
  } catch (error) {
    if (isDomainNotAllowedError(error)) {
      console.warn('[supabase] Pin delete failed — HTTP fetch blocked (pin removed from Redis only)', {
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    console.error('[supabase] Pin delete failed', {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
