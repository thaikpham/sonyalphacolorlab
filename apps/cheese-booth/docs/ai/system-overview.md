# System Overview

## Purpose

Describe the app shell, route ownership, runtime boundaries, and the top-level data layers that matter before editing behavior.

## When To Read This

Read this before changing routes, boot flow, fullscreen/bootstrap behavior, profile selection, or frontend/backend boundaries.

## Canonical Modules

- `src/main.tsx`
- `src/App.tsx`
- `src/app/useDeviceBasedProfile.ts`
- `src/app/KioskShell.tsx`
- `src/app/KioskExperience.tsx`
- `src/hooks/useKioskController.ts`
- `src/hooks/useKioskBootstrap.ts`
- `src/hooks/useKioskFullscreen.ts`
- `src/lib/browserDevice.ts`
- `src/lib/kioskProfiles.ts`
- `src/lib/cloudShare.ts`
- `src/lib/cloudShare/*`
- `api/*`

## Runtime Model

This app is split into two layers:

- Browser frontend:
  React + Vite + `HashRouter`, camera capture, review UX, session state, local settings, QR overlay UI.
- Vercel Functions under `api/*`:
  request validation, signed R2 upload/download URLs, Postgres metadata, tokenized gallery/download access, cleanup cron.

Important boundary:

- The browser owns capture rendering and staging.
- The backend owns trust boundaries, token generation, storage signing, and expiry checks.

## Router Map

The app uses `HashRouter`, so public browser URLs look like `/#/...`.

Top-level routes in `src/App.tsx`:

| Route | Owner | Purpose |
| --- | --- | --- |
| `/` | `LandingPage` | Public landing/entry surface |
| `/session/:token` | `SessionGalleryPage` | Public gallery for a session token |
| `/capture/:profile` | `CaptureScreen` | Main kiosk capture flow |
| `/settings/:profile` | `SettingsDashboard` | Operator settings and live preview |
| `/capture` | redirect | Redirects to detected default profile |
| `/settings` | redirect | Redirects to detected default profile |
| `*` | fallback | Redirects into kiosk capture shell or to a safe default |

Route shell behavior:

- `/` and `/session/:token` render inside the public scroll shell.
- Kiosk routes render inside the kiosk-fit shell.

## Profile Ownership

The app has two kiosk profiles:

- `portrait`
- `landscape`

Profile rules:

- `src/lib/browserDevice.ts` resolves a default profile from device heuristics.
- Desktop browsers default to `landscape`.
- Mobile/coarse-pointer browsers default to `portrait`.
- `src/lib/kioskProfiles.ts` owns route helpers, aspect labels, aspect ratios, and rotation constraints.

## App Boot Sequence

The main kiosk boot flow is:

1. `App` chooses the default profile via `useDeviceBasedProfile`.
2. `KioskShell` validates the `:profile` route param.
3. `KioskExperience` calls `useKioskController(profile)`.
4. `useOperatorSettings` loads profile-scoped operator settings from localStorage.
5. `useKioskBootstrap` calls `openCapture()` once settings are ready.
6. `useCameraSession` probes permission and enumerates/selects devices.
7. `useKioskFullscreen` attempts fullscreen on load, focus, visibility changes, and first user interaction fallback.

## Top-Level Data Layers

### Operator settings

Owned by:
- `src/hooks/useOperatorSettings.ts`
- `src/lib/settingsStore.ts`

Responsibilities:

- load/save profile-scoped settings from browser localStorage
- normalize settings so profile constraints remain valid
- persist the selected HDMI audio source for `60s Performance`
- persist changes automatically after initialization

### Camera session

Owned by:
- `src/hooks/useCameraSession.ts`

Responsibilities:

- permission probe
- device enumeration
- preferred device selection
- HDMI audio source enumeration + auto-pairing
- live `MediaStream` lifecycle
- missing-device/error handling
- native MP4 performance capability reporting

### Preview rendering

Owned by:
- `src/hooks/usePreviewCanvas.ts`

Responsibilities:

- draw the live video into a transformed `<canvas>`
- apply rotation and flip settings
- keep preview output aligned with kiosk aspect ratio

### Browser capture session

Owned by:
- `src/hooks/useCaptureActions.ts`
- `src/hooks/useBrowserCaptureSession.ts`

Responsibilities:

- countdown and shutter flow
- boomerang/performance recording progress
- review-before-commit flow
- session item staging and approval
- session finalization to cloud share
- retry/reset/cancel handling

Important rule:

- `performance` sessions are single-clip sessions and upload one `.mp4` item.

### Cloud-share API client

Owned by:
- `src/lib/cloudShare.ts`
- `src/lib/cloudShare/sessionClient.ts`
- `src/lib/cloudShare/legacyClient.ts`
- `src/lib/cloudShare/shared.ts`

Responsibilities:

- frontend fetch wrappers for `api/*`
- upload to presigned R2 URLs
- session gallery fetches
- local/runtime-specific error messaging
- separation between current session-share flow and legacy single-capture compatibility helpers

## Styling Boundary

Typography and global primitives:

- `src/styles/fonts.css`
- `src/styles/base.css`
- `src/styles/primitives.css`
- `src/styles/tokens.css`

Page/domain styles:

- landing: imported by `src/components/LandingPage.tsx`
- capture kiosk: imported by `src/components/CaptureScreen.tsx`
- settings: imported by `src/components/SettingsDashboard.tsx`
- session gallery: imported by `src/components/SessionGalleryPage.tsx`

Typography note:

- The app now uses local Noto fonts from `src/assets/fonts/noto/`, loaded through `src/styles/fonts.css`.

## Edit Guide

If you are changing:

- route ownership or redirects:
  edit `src/App.tsx`, `src/app/KioskShell.tsx`, or `src/app/KioskExperience.tsx` and update this doc
- default profile/device heuristics:
  edit `src/lib/browserDevice.ts`, `src/app/useDeviceBasedProfile.ts`, and their tests
- fullscreen/bootstrap behavior:
  edit `useKioskBootstrap.ts` or `useKioskFullscreen.ts`
- frontend/backend integration URLs or request semantics:
  edit `src/lib/cloudShare/*` and the matching `api/*` route docs
