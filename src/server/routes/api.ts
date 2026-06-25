import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  CreatePinRequest,
  CreatePinResponse,
  CreatePartnerPostResponse,
  DeletePinResponse,
  GeocodeSearchResponse,
  InitResponse,
  PartnerPin,
} from '../../shared/api';
import { submitPartnerPinPost } from '../core/partner-post';
import { searchPlaces } from './geocode';
import { fetchOsmBasemapTile } from './map-tiles';
import {
  syncPartnerPinToSupabase,
} from '../supabase-partner-pins';
import {
  profileFromPin,
  readPartnerPinProfile,
  removeAllPartnerDataForUser,
  syncPartnerPinProfileToOtherPosts,
  upsertUserPinIndexEntry,
  writePartnerPinProfile,
} from '../partner-pin-profile';

type ErrorResponse = {
  status: 'error';
  message: string;
};

function pinsRedisKey(postId: string): string {
  return `partner-pins:${postId}`;
}

async function readPins(postId: string): Promise<PartnerPin[]> {
  const raw = await redis.get(pinsRedisKey(postId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PartnerPin[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePins(postId: string, pins: PartnerPin[]): Promise<void> {
  await redis.set(pinsRedisKey(postId), JSON.stringify(pins));
}

function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function sanitizeSocialLinks(raw: CreatePinRequest['socialLinks']): PartnerPin['socialLinks'] {
  const trim = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  return {
    instagram: trim(raw?.instagram),
    x: trim(raw?.x),
    facebook: trim(raw?.facebook),
    allcourt: trim(raw?.allcourt),
    other: trim(raw?.other),
  };
}

export const api = new Hono();

api.get('/geocode', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  if (q.length < 2) {
    return c.json<GeocodeSearchResponse>({ type: 'geocode-search', results: [] });
  }
  if (q.length > 280) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Query too long.' }, 400);
  }

  try {
    const results = await searchPlaces(q, 6);
    return c.json<GeocodeSearchResponse>({ type: 'geocode-search', results });
  } catch (error) {
    console.error('Geocode search error:', error);
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Could not search for that location.' },
      502
    );
  }
});

api.get('/map-tiles/:z/:x/:y', async (c) => {
  const z = c.req.param('z');
  const x = c.req.param('x');
  const y = c.req.param('y');
  console.log('[find10spartner:map-tiles] Tile request', { z, x, y });

  try {
    const upstream = await fetchOsmBasemapTile(z, x, y);
    if (!upstream) {
      return c.text('Invalid tile coordinates', 400);
    }
    if (!upstream.ok) {
      console.error('[find10spartner:map-tiles] Proxy returning 404', {
        z,
        x,
        y,
        upstreamStatus: upstream.status,
      });
      return c.text('Tile not found', 404);
    }

    const body = await upstream.arrayBuffer();
    c.header('Content-Type', 'image/png');
    c.header('Cache-Control', 'public, max-age=86400');
    return c.body(body);
  } catch (error) {
    console.error('[find10spartner:map-tiles] Map tile proxy error:', {
      z,
      x,
      y,
      error,
    });
    return c.text('Failed to load map tile', 502);
  }
});

api.post('/map-log', async (c) => {
  let body: { level?: string; message?: string; detail?: Record<string, unknown> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false }, 400);
  }

  const message = typeof body.message === 'string' ? body.message : 'Map log';
  const detail = body.detail ?? {};
  const prefix = '[find10spartner:map]';

  if (body.level === 'error') {
    console.error(`${prefix} ${message}`, detail);
  } else {
    console.log(`${prefix} ${message}`, detail);
  }

  return c.json({ ok: true });
});

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required but missing from context' },
      400
    );
  }

  try {
    const username = await reddit.getCurrentUsername();
    const [pins, pinProfile] = await Promise.all([
      readPins(postId),
      username ? readPartnerPinProfile(username) : Promise.resolve(null),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId,
      username: username ?? 'anonymous',
      pins,
      pinProfile,
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    const message =
      error instanceof Error ? `Initialization failed: ${error.message}` : 'Unknown error';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

api.post('/pins', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }

  const username = await reddit.getCurrentUsername();
  if (!username) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Sign in to Reddit to drop a pin.' },
      401
    );
  }

  let body: CreatePinRequest;
  try {
    body = await c.req.json<CreatePinRequest>();
  } catch {
    return c.json<ErrorResponse>({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  const utrLevel = typeof body.utrLevel === 'string' ? body.utrLevel.trim() : '';
  const locationLabel =
    typeof body.locationLabel === 'string' ? body.locationLabel.trim() : '';

  if (!utrLevel) {
    return c.json<ErrorResponse>({ status: 'error', message: 'UTR level is required.' }, 400);
  }
  if (!locationLabel) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'City / court is required.' },
      400
    );
  }
  if (!isValidLatLng(body.lat, body.lng)) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Invalid map coordinates.' }, 400);
  }

  const socialLinks = sanitizeSocialLinks(body.socialLinks);
  const hasSocial =
    socialLinks.instagram ||
    socialLinks.x ||
    socialLinks.facebook ||
    socialLinks.allcourt ||
    socialLinks.other;
  if (!hasSocial) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Add at least one profile or social link.' },
      400
    );
  }

  const pins = await readPins(postId);
  const now = new Date().toISOString();
  const existingIndex = pins.findIndex((pin) => pin.username === username);
  const existingPin = existingIndex >= 0 ? pins[existingIndex]! : null;
  const pin: PartnerPin = {
    id: existingPin?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    lat: body.lat,
    lng: body.lng,
    utrLevel,
    locationLabel,
    socialLinks,
    username,
    createdAt: existingPin?.createdAt ?? now,
  };

  const nextPins =
    existingIndex >= 0
      ? pins.map((entry, index) => (index === existingIndex ? pin : entry))
      : [...pins, pin];

  await writePins(postId, nextPins);

  const pinProfile = profileFromPin(pin);
  await writePartnerPinProfile(username, pinProfile);
  await upsertUserPinIndexEntry(username, postId, pin.id);

  const pinAction = existingIndex >= 0 ? 'update' : 'create';
  console.log('[pins] Pin saved to Redis, queueing Supabase sync', {
    action: pinAction,
    pinId: pin.id,
    redditUsername: username,
    redditPostId: postId,
  });
  void syncPartnerPinToSupabase(pin, postId, context.subredditName);
  void syncPartnerPinProfileToOtherPosts(
    username,
    postId,
    { utrLevel, locationLabel, socialLinks },
    context.subredditName
  );

  return c.json<CreatePinResponse>({
    type: 'create-pin',
    pin,
    pins: nextPins,
    pinProfile,
  });
});

api.delete('/pins/:pinId', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }

  const username = await reddit.getCurrentUsername();
  if (!username) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Sign in to Reddit to remove your pin.' },
      401
    );
  }

  const pinId = c.req.param('pinId');
  const pins = await readPins(postId);
  const target = pins.find((pin) => pin.id === pinId);
  if (!target) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Pin not found.' }, 404);
  }
  if (target.username !== username) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'You can only remove your own pin.' },
      403
    );
  }

  const nextPins = await removeAllPartnerDataForUser(username, postId);

  return c.json<DeletePinResponse>({
    type: 'delete-pin',
    pins: nextPins,
    pinProfile: null,
  });
});

api.post('/posts/from-pin', async (c) => {
  const { postId, subredditName } = context;

  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }
  if (!subredditName) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'subredditName is required but missing from context' },
      400
    );
  }

  const username = await reddit.getCurrentUsername();
  if (!username) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Sign in to Reddit to create a post.' },
      401
    );
  }

  let body: { pinId?: string; title?: string; text?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json<ErrorResponse>({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  const pinId = body.pinId?.trim();
  const title = body.title?.trim();
  const text = typeof body.text === 'string' ? body.text : '';

  if (!pinId || !title) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'pinId and title are required' },
      400
    );
  }

  const pins = await readPins(postId);
  const pin = pins.find((entry) => entry.id === pinId);
  if (!pin) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Pin not found on this thread.' }, 404);
  }
  if (pin.username !== username) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'You can only post from your own pin.' },
      403
    );
  }

  try {
    const post = await submitPartnerPinPost({
      subredditName,
      title,
      text,
    });
    return c.json<CreatePartnerPostResponse>({
      type: 'post-created',
      postId: post.id,
      pinId,
    });
  } catch (error) {
    console.error('[api/posts/from-pin]', error);
    const message = error instanceof Error ? error.message : 'Failed to create post';
    return c.json<ErrorResponse>({ status: 'error', message }, 502);
  }
});
