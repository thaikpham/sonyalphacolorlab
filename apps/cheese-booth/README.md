# Cheese Booth Browser Kiosk

Browser-only photobooth kiosk built with React, Vite, Vercel Functions, R2, and Postgres metadata.

## What Lives Here

- Browser capture UI
- Session-based capture flow with max 4 media / session
- Single QR gallery sharing flow
- Vercel Functions under `api/*`
- Session gallery and media endpoints
- Browser operator settings stored in localStorage

This repo no longer ships desktop runtime, Tauri packaging, or inline desktop installer catalog logic.

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

## Desktop Split

Desktop source has been split out into the sibling folder:

- `../kiosk-desktop`

That folder is the continuation baseline for Tauri/local-save desktop work.

Until a dedicated desktop remote is provisioned, the existing GitHub releases page is treated as the public archive:

- https://github.com/thaikpham/colorlabv2-photokiosk/releases
