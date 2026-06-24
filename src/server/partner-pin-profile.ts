import { redis } from '@devvit/web/server';
import type { PartnerPin, PartnerPinProfile, PartnerPinSocialLinks } from '../shared/api';
import { deletePartnerPinFromAllCourt, syncPartnerPinToAllCourt } from './allcourt-partner-pins';

type UserPinIndexEntry = {
  postId: string;
  pinId: string;
};

function profileRedisKey(username: string): string {
  return `partner-pin-profile:${username}`;
}

function userPinIndexRedisKey(username: string): string {
  return `partner-user-pins:${username}`;
}

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

export async function readPartnerPinProfile(username: string): Promise<PartnerPinProfile | null> {
  const raw = await redis.get(profileRedisKey(username));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PartnerPinProfile;
    if (typeof parsed.utrLevel !== 'string' || typeof parsed.locationLabel !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writePartnerPinProfile(
  username: string,
  profile: PartnerPinProfile
): Promise<void> {
  await redis.set(profileRedisKey(username), JSON.stringify(profile));
}

export function profileFromPin(pin: PartnerPin): PartnerPinProfile {
  return {
    utrLevel: pin.utrLevel,
    locationLabel: pin.locationLabel,
    socialLinks: pin.socialLinks,
    lastLat: pin.lat,
    lastLng: pin.lng,
  };
}

async function readUserPinIndex(username: string): Promise<UserPinIndexEntry[]> {
  const raw = await redis.get(userPinIndexRedisKey(username));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as UserPinIndexEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeUserPinIndex(username: string, index: UserPinIndexEntry[]): Promise<void> {
  await redis.set(userPinIndexRedisKey(username), JSON.stringify(index));
}

export async function upsertUserPinIndexEntry(
  username: string,
  postId: string,
  pinId: string
): Promise<void> {
  const index = await readUserPinIndex(username);
  const next = index.filter((entry) => entry.postId !== postId);
  next.push({ postId, pinId });
  await writeUserPinIndex(username, next);
}

export async function removeUserPinIndexEntry(username: string, postId: string): Promise<void> {
  const index = await readUserPinIndex(username);
  const next = index.filter((entry) => entry.postId !== postId);
  await writeUserPinIndex(username, next);
}

/**
 * Remove every pin attached to a deleted post from Redis, the per-user index,
 * and the synced AllCourt/Supabase store. Used by the Reddit PostDelete trigger
 * so partner data does not outlive the post it belonged to.
 */
export async function removeAllPinsForPost(postId: string): Promise<void> {
  const pins = await readPins(postId);

  for (const pin of pins) {
    void deletePartnerPinFromAllCourt(pin.id);
    await removeUserPinIndexEntry(pin.username, postId);
  }

  await redis.del(pinsRedisKey(postId));
}

export async function syncPartnerPinProfileToOtherPosts(
  username: string,
  currentPostId: string,
  profile: {
    utrLevel: string;
    locationLabel: string;
    socialLinks: PartnerPinSocialLinks;
  },
  subredditName: string | undefined
): Promise<void> {
  const index = await readUserPinIndex(username);
  const now = new Date().toISOString();

  for (const entry of index) {
    if (entry.postId === currentPostId) continue;

    const pins = await readPins(entry.postId);
    const pinIndex = pins.findIndex((pin) => pin.username === username);
    if (pinIndex < 0) continue;

    const existing = pins[pinIndex]!;
    const updated: PartnerPin = {
      ...existing,
      utrLevel: profile.utrLevel,
      locationLabel: profile.locationLabel,
      socialLinks: profile.socialLinks,
      createdAt: now,
    };
    pins[pinIndex] = updated;
    await writePins(entry.postId, pins);
    void syncPartnerPinToAllCourt(updated, entry.postId, subredditName);
  }
}
