## Devvit React Starter

A starter to build web applications on Reddit's developer platform

- [Devvit](https://developers.reddit.com/): A way to build and deploy immersive games on Reddit
- [Vite](https://vite.dev/): For compiling the webView
- [React](https://react.dev/): For UI
- [Hono](https://hono.dev/): For backend logic
- [Tailwind](https://tailwindcss.com/): For styles
- [TypeScript](https://www.typescriptlang.org/): For type safety

## Domain access

Reddit Devvit blocks outbound HTTP to hosts that are not on your app’s allowlist, so this app lists several **Domain exceptions** in `devvit.json` that must be approved in Developer Settings before everything works. **`allcourt.pro`** and **`challenge.allcourt.pro`** are AllCourt Pro hosts: the Devvit server syncs partner pins (location, UTR, social links) to `https://www.allcourt.pro/api/reddit/partner-pins` so pins persist beyond a single Reddit post, and the in-app footer sends users to AllCourt Pro on `challenge.allcourt.pro`. **`tile.openstreetmap.org`** and the **`a`/`b`/`c` tile subdomains** supply OpenStreetMap raster tiles that the server proxies at `/api/map-tiles` to render the interactive partner map. The **`a`–`d.basemaps.cartocdn.com`** hosts are Carto’s basemap CDN tile servers, included so the map can load standard Carto basemap imagery (the same tile CDN pattern used elsewhere in the AllCourt Pro stack). Until Reddit marks these domains **Approved** (currently **Pending**), map tiles may not load and AllCourt sync is skipped—pins are still saved in Redis, and no code changes are needed once approval completes.

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

# this sets the variable for the live and local app
npx devvit settings set allcourt-partner-pins-secret 