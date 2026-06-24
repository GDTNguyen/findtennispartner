/**
 * Local smoke test for Supabase partner-pin sync (mirrors src/server/supabase-partner-pins.ts).
 *
 * Uses the same host, table, headers, and PostgREST calls as the Devvit server.
 * Key source: SUPABASE_SERVICE_ROLE_KEY env var (same value as devvit settings
 * `supabase-service-role-key` and AllCourt Pro's .env.local).
 *
 * Usage:
 *   npm run test:supabase
 *   npm run test:supabase -- --upsert
 *   npm run test:supabase -- --delete --pin-id <id>
 *   npm run test:supabase -- --upsert --dry-run
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run test:supabase
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const ALLCOURT_ENV = join(REPO_ROOT, '..', 'allcourtpro', '.env.local');

const SUPABASE_HOST = 'amspslqidldfolaborfi.supabase.co';
const SUPABASE_REST_BASE = `https://${SUPABASE_HOST}/rest/v1`;
const PARTNER_PINS_TABLE = 'reddit_partner_pins';

type SocialLinks = {
  instagram?: string;
  x?: string;
  facebook?: string;
  allcourt?: string;
  other?: string;
};

function loadEnvFile(path: string, override = false): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function readFlag(argv: string[], names: string[]): string | undefined {
  for (const name of names) {
    const eq = `--${name}=`;
    const idx = argv.findIndex((arg) => arg === `--${name}` || arg.startsWith(eq));
    if (idx < 0) continue;
    const arg = argv[idx];
    if (arg.startsWith(eq)) return arg.slice(eq.length).trim() || undefined;
    return argv[idx + 1]?.trim() || undefined;
  }
  return undefined;
}

function supabaseHeaders(key: string, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

function sanitizeSocialLinks(raw: SocialLinks): SocialLinks {
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

function partnerPinRow(input: {
  id: string;
  postId: string;
  username: string;
  subreddit?: string;
  lat: number;
  lng: number;
  utrLevel: string;
  locationLabel: string;
  socialLinks: SocialLinks;
  pinnedAt: string;
}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: input.id,
    reddit_post_id: input.postId,
    reddit_username: input.username,
    reddit_subreddit: input.subreddit?.trim() || null,
    lat: input.lat,
    lng: input.lng,
    utr_level: input.utrLevel.trim(),
    location_label: input.locationLabel.trim(),
    social_links: sanitizeSocialLinks(input.socialLinks),
    pinned_at: input.pinnedAt,
    updated_at: now,
  };
}

async function ping(key: string): Promise<void> {
  const url = `${SUPABASE_REST_BASE}/${PARTNER_PINS_TABLE}?select=id,reddit_post_id,reddit_username&limit=3`;
  console.log('[test] GET (health check)', { host: SUPABASE_HOST, table: PARTNER_PINS_TABLE, url });

  const res = await fetch(url, {
    headers: supabaseHeaders(key),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PostgREST returned HTTP ${res.status}: ${text}`);
  }

  const rows = JSON.parse(text) as unknown[];
  console.log('[test] Connection OK', { httpStatus: res.status, sampleRowCount: rows.length, rows });
}

async function upsert(key: string, dryRun: boolean): Promise<string> {
  const pinId = `script-test-${Date.now()}`;
  const postId = 't3_script_test_post';
  const row = partnerPinRow({
    id: pinId,
    postId,
    username: 'script_test_user',
    subreddit: 'find10spartner_test',
    lat: 40.758,
    lng: -73.9855,
    utrLevel: '4.5',
    locationLabel: 'Script test pin (safe to delete)',
    socialLinks: { other: 'https://example.com/script-test' },
    pinnedAt: new Date().toISOString(),
  });

  const url = `${SUPABASE_REST_BASE}/${PARTNER_PINS_TABLE}?on_conflict=reddit_post_id,reddit_username`;
  console.log('[test] POST upsert (same as Devvit syncPartnerPinToSupabase)', {
    url,
    pinId,
    row,
  });

  if (dryRun) {
    console.log('[test] Dry run — request not sent. Re-run without --dry-run to upsert.');
    return pinId;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: supabaseHeaders(key, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    }),
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PostgREST returned HTTP ${res.status}: ${text}`);
  }

  const rows = JSON.parse(text) as Array<{ id?: string }>;
  console.log('[test] Upsert succeeded', {
    httpStatus: res.status,
    supabasePinId: rows[0]?.id ?? pinId,
    deleteWith: `npm run test:supabase -- --delete --pin-id ${pinId}`,
  });
  return pinId;
}

async function remove(key: string, pinId: string, dryRun: boolean): Promise<void> {
  const url = `${SUPABASE_REST_BASE}/${PARTNER_PINS_TABLE}?id=eq.${encodeURIComponent(pinId)}`;
  console.log('[test] DELETE (same as Devvit deletePartnerPinFromSupabase)', { url, pinId });

  if (dryRun) {
    console.log('[test] Dry run — request not sent.');
    return;
  }

  const res = await fetch(url, {
    method: 'DELETE',
    headers: supabaseHeaders(key, { Prefer: 'return=representation' }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`PostgREST returned HTTP ${res.status}${text ? `: ${text}` : ''}`);
  }

  const text = await res.text();
  const rows = text ? (JSON.parse(text) as unknown[]) : [];
  console.log('[test] Delete finished', { httpStatus: res.status, deletedRows: rows.length, rows });
}

async function main(): Promise<void> {
  loadEnvFile(join(REPO_ROOT, '.env'));
  loadEnvFile(ALLCOURT_ENV, true);

  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const doUpsert = argv.includes('--upsert');
  const doDelete = argv.includes('--delete');
  const pinId = readFlag(argv, ['pin-id', 'pinId']);
  const envFile = readFlag(argv, ['env-file']);
  if (envFile) {
    loadEnvFile(envFile, true);
  }

  const key =
    readFlag(argv, ['key', 'service-role-key'])?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    '';

  if (!key) {
    console.error(
      [
        'Missing Supabase service role key.',
        'Set SUPABASE_SERVICE_ROLE_KEY (same as devvit `supabase-service-role-key` / AllCourt Pro .env.local), or pass --key.',
        'Example:',
        '  SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run test:supabase',
        '  npm run test:supabase -- --env-file ../allcourtpro/.env.local',
      ].join('\n'),
    );
    process.exit(1);
  }

  console.log('[test] Using Supabase project', {
    host: SUPABASE_HOST,
    keyPreview: `${key.slice(0, 8)}…${key.slice(-4)} (${key.length} chars)`,
  });

  if (doDelete) {
    if (!pinId) {
      console.error('--delete requires --pin-id <id>');
      process.exit(1);
    }
    await remove(key, pinId, dryRun);
    return;
  }

  if (doUpsert) {
    await upsert(key, dryRun);
    return;
  }

  await ping(key);
}

main().catch((error: unknown) => {
  console.error('[test] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
