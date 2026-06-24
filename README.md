## Devvit React Starter

A starter to build web applications on Reddit's developer platform

- [Devvit](https://developers.reddit.com/): A way to build and deploy immersive games on Reddit
- [Vite](https://vite.dev/): For compiling the webView
- [React](https://react.dev/): For UI
- [Hono](https://hono.dev/): For backend logic
- [Tailwind](https://tailwindcss.com/): For styles
- [TypeScript](https://www.typescriptlang.org/): For type safety

## Domain access

Reddit Devvit blocks outbound HTTP to hosts that are not on your app’s allowlist, so this app lists **Domain exceptions** in `devvit.json` that must be approved in Developer Settings before everything works.

**`amspslqidldfolaborfi.supabase.co`** — AllCourt Pro’s Supabase project. Partner pins (location, UTR, social links) must be stored in Supabase, not only in Devvit Redis: Redis is scoped to the app runtime and does not give you a durable, queryable store that other posts or the AllCourt site can read. Supabase holds the canonical `reddit_partner_pins` rows so a pin survives beyond a single Reddit post and can be loaded on the partner map for everyone viewing the thread. The Devvit server upserts and deletes pins there directly over PostgREST (`/rest/v1/reddit_partner_pins`), without calling `allcourt.pro`. Reddit treats `supabase.com` as an approved limited-scope cloud provider, so you request your specific project subdomain—the most granular domain possible.

**`tile.openstreetmap.org`** and the **`a`/`b`/`c` tile subdomains** supply OpenStreetMap raster tiles that the server proxies at `/api/map-tiles` to render the interactive partner map.

**`a`–`d.basemaps.cartocdn.com`** — Carto’s basemap CDN tile servers, included so the map can load standard Carto basemap imagery (the same tile CDN pattern used elsewhere in the AllCourt Pro stack).

Until Reddit marks these domains **Approved** (currently **Pending**), map tiles may not load and Supabase pin sync is skipped—pins are still saved in Redis, and no code changes are needed once approval completes.

Domain exceptions come from `devvit.json` → `permissions.http.domains`. After editing that list, run `npm run deploy` (or upload a new version) so **`amspslqidldfolaborfi.supabase.co`** appears under Developer Settings → Domain exceptions. It will not show up until a deploy picks up the change.

## Getting Started

> Make sure you have Node 22 downloaded on your machine before running!

1. Run `npm create devvit@latest --template=react`
2. Go through the installation wizard. You will need to create a Reddit account and connect it to Reddit developers
3. Copy the command on the success page into your terminal

## Commands

- `npm run dev`: Starts a development server where you can develop your application live on Reddit.
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads a new version of your app
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run type-check`: Type checks, lints, and prettifies your app

## Devvit settings (find10spartner only)

Partner pin sync requires the Supabase service role key (RLS is enabled on `reddit_partner_pins` with no anon policies). Set it once for playtest and production (prompts for the value):

```bash
npx devvit settings set supabase-service-role-key
```

Use the same value as `SUPABASE_SERVICE_ROLE_KEY` in the AllCourt Pro `.env`. Without it, pins stay in Redis only and Supabase sync is skipped.


# Health check (read up to 3 rows)
npm run test:supabase -- --env-file ../allcourtpro/.env.local

# Upsert a throwaway test pin
npm run test:supabase -- --env-file ../allcourtpro/.env.local --upsert

# Delete it afterward
npm run test:supabase -- --env-file ../allcourtpro/.env.local --delete --pin-id script-test-<timestamp>

# Preview request without sending
npm run test:supabase -- --upsert --dry-run