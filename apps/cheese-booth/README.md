# Cheese Booth Browser Kiosk

Browser-only photobooth kiosk built with React, Vite, Vercel Functions, R2,
and Postgres metadata. It is one app in the Alpha ColorLab monorepo and
deploys from `apps/cheese-booth`.

## What Lives Here

- Browser capture UI
- Session-based capture flow with max 4 media / session
- Single QR gallery sharing flow
- Vercel Functions under `api/*`
- Session gallery and media endpoints
- Browser operator settings stored in localStorage

**Online only.** There is no desktop build, no installer and no release
download — the kiosk is opened in a browser and updates when the page is
reloaded. Anything that used to point an operator at a GitHub Releases
archive has been removed: the Settings dashboard's `Desktop app` panel,
`src/lib/externalLinks.ts` and `release-notes/`.

Two consequences worth stating plainly:

- Auto-save to a local folder is gone with the Tauri runtime. Captures
  leave the machine through the cloud-share flow, or not at all.
- The venue needs working network at capture time. The kiosk keeps running
  once the page has loaded, but finalising a session uploads to R2.

## Development

Requirements:

- Node.js 20+

Install dependencies:

```bash
npm ci
```

Run the frontend only:

```bash
npm run dev
```

For full browser + API + QR local testing, prefer:

```bash
vercel dev
```

Validation:

```bash
npm run lint
npm test
npm run build
```

## Cloud Share + Session QR

Browser capture can now:

- start an explicit customer session
- review each shot before adding it
- keep up to 4 photos / boomerangs in one session
- upload the whole session at finalize time
- generate one QR that opens the gallery for that session

Setup and deployment docs:

- Checklist: [docs/vercel-r2-cloud-share-checklist.md](./docs/vercel-r2-cloud-share-checklist.md)
- Local quickstart: [docs/vercel-dev-cloud-share-quickstart.md](./docs/vercel-dev-cloud-share-quickstart.md)
- Go-live checklist: [docs/internal-event-ops-go-live-checklist.md](./docs/internal-event-ops-go-live-checklist.md)
- Operator runbook: [docs/cloud-share-operator-runbook.md](./docs/cloud-share-operator-runbook.md)
- Env template: [.env.example](./.env.example)

Operational endpoint:

- Health check: `/api/health/cloud-share`
