# AI Docs Index

## Purpose

This folder is the condensed repository map for future AI agents.

It should answer:

- what the app is
- where each major responsibility lives
- which modules are canonical for a domain
- where to edit when behavior changes

## When To Read This

Read this file when starting a session and you need the fastest path to the right source-of-truth document.

## Canonical Files

- System / routing / runtime boundary:
  [system-overview.md](./system-overview.md)
- Frontend surfaces and component ownership:
  [frontend-pages-and-components.md](./frontend-pages-and-components.md)
- Hooks, state machines, side effects, cleanup:
  [state-and-flow-map.md](./state-and-flow-map.md)
- API routes, backend helpers, cloud-share contract:
  [api-and-cloud-share.md](./api-and-cloud-share.md)
- Recent important changes:
  [change-log.md](./change-log.md)

## Reading Order By Task

### Landing / marketing UI

1. [frontend-pages-and-components.md](./frontend-pages-and-components.md)
2. [system-overview.md](./system-overview.md)

Source of truth:
- `src/components/LandingPage.tsx`
- `src/styles/landing-page.css`

### Capture kiosk flow

1. [state-and-flow-map.md](./state-and-flow-map.md)
2. [frontend-pages-and-components.md](./frontend-pages-and-components.md)
3. [system-overview.md](./system-overview.md)

Source of truth:
- `src/components/CaptureScreen.tsx`
- `src/hooks/useKioskController.ts`
- `src/hooks/useCaptureActions.ts`
- `src/hooks/useCameraSession.ts`
- `src/components/capture/*`

### Settings dashboard

1. [frontend-pages-and-components.md](./frontend-pages-and-components.md)
2. [state-and-flow-map.md](./state-and-flow-map.md)

Source of truth:
- `src/components/SettingsDashboard.tsx`
- `src/components/settings-dashboard/*`
- `src/hooks/useOperatorSettings.ts`

### Session gallery

1. [frontend-pages-and-components.md](./frontend-pages-and-components.md)
2. [api-and-cloud-share.md](./api-and-cloud-share.md)

Source of truth:
- `src/components/SessionGalleryPage.tsx`
- `src/lib/cloudShare.ts`
- `api/capture-sessions/gallery.ts`
- `api/capture-sessions/media.ts`

### Cloud-share API / backend

1. [api-and-cloud-share.md](./api-and-cloud-share.md)
2. [state-and-flow-map.md](./state-and-flow-map.md)

Source of truth:
- `api/_lib/*`
- `api/capture-sessions/*`
- `api/captures/*`
- `src/lib/cloudShare.ts`

### Ops / deploy references

Read these existing docs instead of expanding the AI docs into long runbooks:

- [../vercel-r2-cloud-share-checklist.md](../vercel-r2-cloud-share-checklist.md)
- [../vercel-dev-cloud-share-quickstart.md](../vercel-dev-cloud-share-quickstart.md)
- [../cloud-share-operator-runbook.md](../cloud-share-operator-runbook.md)
- [../internal-event-ops-go-live-checklist.md](../internal-event-ops-go-live-checklist.md)

## Documentation Rule

Whenever code changes alter a domain covered here:

1. Update the relevant file in `docs/ai/`
2. Add a short entry to [change-log.md](./change-log.md)

Only update `AGENTS.md` when the entrypoint guidance itself changes:

- new major domain
- new reading order
- changed source-of-truth module
- changed repo/runtime boundary
