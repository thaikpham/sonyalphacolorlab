# AI Change Log

## Purpose

Give future agents a short history of important architecture and behavior changes without requiring a full git diff scan.

## When To Read This

Read this at the start of a session if you need to know what changed recently before deciding where to inspect code.

## Canonical Modules

- This file
- the domain docs in `docs/ai/`

## Format

Only record meaningful changes to:

- page composition
- route structure
- state/flow behavior
- backend/API contracts
- repo documentation source-of-truth

Skip trivial pixel-only tweaks unless they changed interaction or ownership.

## Entries

| Date | Area | Changed behavior | Touched modules / docs |
| --- | --- | --- | --- |
| 2026-04-16 | Performance capture mode | Added `60s Performance` as a single-clip session mode with native MP4 recording, optional HDMI audio pairing from Cam Link, silent fallback when audio is unavailable, and gallery download support for `.mp4` clips. Session init/backend validation now recognize `performance` media and enforce the one-item rule. | `src/lib/media.ts`, `src/hooks/useCameraSession.ts`, `src/hooks/useCaptureActions.ts`, `src/components/capture/*`, `src/components/SettingsDashboard.tsx`, `src/components/SessionGalleryPage.tsx`, `api/_lib/capturePayload.ts`, `api/_lib/db.ts`, `api/capture-sessions/init.ts`, `docs/ai/system-overview.md`, `docs/ai/frontend-pages-and-components.md`, `docs/ai/state-and-flow-map.md`, `docs/ai/api-and-cloud-share.md`, `docs/ai/change-log.md` |
| 2026-04-16 | Route shell / frontend refactor | Split route/profile boot into `src/app/*`, lazy-loaded settings and session gallery surfaces, extracted capture/session and camera helper modules, and separated cloud-share client code into session vs legacy compatibility layers. Capture page CSS is now route-local and legacy `capture.css` was removed. | `src/App.tsx`, `src/app/*`, `src/hooks/captureActions/*`, `src/hooks/cameraSession/*`, `src/lib/cloudShare*`, `src/components/capture/*`, `src/components/settings-dashboard/*`, `docs/ai/system-overview.md`, `docs/ai/frontend-pages-and-components.md`, `docs/ai/state-and-flow-map.md`, `docs/ai/api-and-cloud-share.md`, `docs/ai/change-log.md` |
| 2026-04-15 | AI docs pack | Added `AGENTS.md` plus `docs/ai/*` as the Codex-first repository map. Future feature/flow/route/API changes must update the matching docs in the same session. | `AGENTS.md`, `docs/ai/README.md`, `docs/ai/system-overview.md`, `docs/ai/frontend-pages-and-components.md`, `docs/ai/state-and-flow-map.md`, `docs/ai/api-and-cloud-share.md`, `docs/ai/change-log.md` |
| 2026-04-15 | Capture dock / session flow | Replaced split dock actions with one fixed multi-state session button. The dock stays in a stable three-slot layout and destructive cancel/reset now uses long-press inline confirmation. | `src/components/capture/CaptureSideRail.tsx`, `src/components/CaptureScreen.tsx`, `src/hooks/useCaptureActions.ts`, `docs/ai/frontend-pages-and-components.md`, `docs/ai/state-and-flow-map.md` |
| 2026-04-15 | Session tray responsibility | Session tray is now display-only. Start/finalize/cancel actions no longer live in the tray, which reduces layout shift and centralizes session control in the dock. | `src/components/capture/BrowserSessionFilmStripRail.tsx`, `src/components/capture/CaptureSideRail.tsx`, `docs/ai/frontend-pages-and-components.md` |
| 2026-04-15 | Session tray quick delete | Added an inline `X` button on committed session thumbnails so operators can remove a shot, free the slot, and continue capturing. Remaining items are resequenced to keep the session contiguous up to the four-item limit. | `src/components/capture/BrowserSessionFilmStripRail.tsx`, `src/hooks/useBrowserCaptureSession.ts`, `src/hooks/useCaptureActions.ts`, `src/components/CaptureScreen.tsx`, `src/styles/capture-enterprise.css`, `docs/ai/frontend-pages-and-components.md`, `docs/ai/state-and-flow-map.md` |
| 2026-04-15 | Landscape support-column header | In landscape capture layout, the brand header moved from a full-width top row into the right-side support column so it sits directly above the session tray. | `src/components/CaptureScreen.tsx`, `src/styles/capture-enterprise.css`, `docs/ai/frontend-pages-and-components.md` |
| 2026-04-15 | Outcome overlay heading cleanup | Removed the overlay kicker and heading icon. Outcome headings now render as centered title + description blocks aligned to the same vertical axis as stacked action buttons. | `src/components/capture/BrowserSessionOverlay.tsx`, `src/styles/capture-enterprise.css`, `docs/ai/frontend-pages-and-components.md` |
| 2026-04-15 | Device-aware default profile | The app now defaults desktop browsers to `landscape` and mobile/coarse-pointer browsers to `portrait`, with tests covering the detection utility. | `src/lib/browserDevice.ts`, `src/App.tsx`, `tests/lib/browserDevice.test.ts`, `docs/ai/system-overview.md` |
| 2026-04-15 | Orientation toggle moved to header | The portrait/landscape switch was removed from `CapturePreviewTelemetry` and moved into the page header as an icon-only action with hover/title hint. In landscape it sits on the right side of the support-column header. | `src/components/CaptureScreen.tsx`, `src/components/capture/CapturePreviewTelemetry.tsx`, `src/styles/capture-enterprise.css`, `docs/ai/frontend-pages-and-components.md` |
| 2026-04-15 | Typography system | Switched the site to local Noto fonts. `Noto Sans` is the base UI face, `Noto Sans Display` is used for display/headline text, and `Noto Sans Mono` is used for technical/monospace labels. | `src/styles/fonts.css`, `src/main.tsx`, `src/styles/base.css`, `src/styles/landing-page.css`, `src/styles/capture-enterprise.css`, `src/styles/settings-dashboard.css`, `docs/ai/system-overview.md` |
