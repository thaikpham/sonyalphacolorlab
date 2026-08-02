# Frontend Pages And Components

## Purpose

Map the major frontend surfaces, their primary child components, user-visible states, and where to edit behavior without scanning every TSX/CSS file.

## When To Read This

Read this before changing page layout, component composition, visual hierarchy, or deciding which component actually owns a behavior.

## Canonical Modules

- `src/components/LandingPage.tsx`
- `src/components/CaptureScreen.tsx`
- `src/components/SettingsDashboard.tsx`
- `src/components/SessionGalleryPage.tsx`
- `src/components/capture/*`
- `src/components/settings-dashboard/*`

## Landing Page

### Purpose

Minimal public entry surface that brands the booth and routes the user into the detected kiosk profile.

### Composition

- `LandingPage`
  - clickable cheese/logo entry point
  - brand title and animated subtitle lines

### Inputs / Dependencies

- `defaultProfile` prop from `App`
- `getCaptureRoute()` from `src/lib/kioskProfiles.ts`
- styles in `src/styles/landing-page.css`

### State / Modes

- No internal interaction state beyond navigation.
- The page is intentionally static and lightweight.

### Edit Guide

Change this page when you need to edit:

- branding copy
- hero composition
- entry CTA behavior
- landing-only visuals

Do not put kiosk camera/session logic here.

## Capture Screen

### Purpose

Primary kiosk runtime. It holds the live preview, quick camera controls, shutter flow, session tray, control dock, and overlay-driven review/share states.

### Composition

- `CaptureScreen`
  - header / brand link
  - `CapturePreviewTelemetry`
  - `CapturePreview`
  - `BrowserSessionFilmStripRail`
  - `CaptureSideRail`
  - `BrowserSessionOverlay`

Landscape layout:

- stage on the left
- support region on the right
  - brand header
  - session tray
  - control dock
- tray above dock

Portrait layout:

- header
- telemetry
- preview
- dock
- tray

### Inputs / Dependencies

Key props come from `useKioskController`:

- operator settings
- source list
- permission/stream state
- busy/countdown/boomerang indicators
- browser session state
- preview refs
- action callbacks for shutter/session/settings changes

Primary layout/style file:

- `src/styles/capture-enterprise.css`

### State / Modes

User-facing modes:

- permission not granted
- source missing
- live preview ready
- countdown in progress
- boomerang recording in progress
- `60s Performance` recording in progress
- shot review overlay
- session finalizing
- QR ready overlay
- session share error overlay

### Edit Guide

Edit `CaptureScreen.tsx` when changing:

- page composition
- portrait vs landscape arrangement
- which child component receives which action

Edit these subcomponents for focused behavior:

- `CapturePreviewTelemetry.tsx`
  quick settings chips and inline menus
- `CapturePreview.tsx`
  live preview shell, permission/source/countdown overlays
- `CaptureSideRail.tsx`
  dock controls, fixed multi-state session button, long-press confirm UX
- `SessionFlowButton.tsx`
  session button state + long-press UI, keyed by session status/item-count resets
- `BrowserSessionFilmStripRail.tsx`
  session tray with visual occupancy and quick delete for committed items
- `BrowserSessionOverlay.tsx`
  review, finalizing, QR-ready, and error overlays
- `CaptureScreenSections.tsx`
  header, stage composition, and tray wiring extracted from `CaptureScreen`

Important current rule:

- The dock uses a fixed three-slot layout:
  settings, shutter, session-flow button.
- The session tray no longer owns start/finalize/cancel actions, but it does own quick delete for already committed items while the session is active.
- In landscape, the brand header now lives inside the support column above the session tray instead of spanning the full shell width.
- The portrait/landscape switch now lives in the header as an icon-only action with a hover hint, not inside the telemetry chips.

## Settings Dashboard

### Purpose

Operator-facing page for configuring capture mode, camera source, transforms, and cloud-share context while showing the same live preview pipeline used by capture mode.

### Composition

- `SettingsDashboard`
  - `SettingsDashboardNav`
  - `SettingsDashboardPreview`
  - one active panel from `SettingsDashboardPanels.tsx`
  - floating back link to capture

Sections:

- overview
- capture
- camera
- output
- transform
- download

### Inputs / Dependencies

- same core settings/camera state from `useKioskController`
- section-local rendering inside `renderContent()`
- preview reused through `CapturePreview`
- runtime summary from `src/lib/runtime.ts`

Primary style file:

- `src/styles/settings-dashboard.css`

### State / Modes

- section switch state is local to `SettingsDashboard`
- live preview/error/permission behavior mirrors the capture preview
- inputs disable when the kiosk is busy

### Edit Guide

Edit `SettingsDashboard.tsx` when changing:

- page composition
- section switching
- portrait/landscape layout of controls vs preview

- `settingsDashboardPanelRegistry.tsx` now owns the typed section-to-panel mapping.
- `settings-dashboard/panels/*` now owns each section independently.

Edit those panel modules when changing:

- settings form content
- copy
- operator summaries
- HDMI audio pairing / fallback messaging

Edit `SettingsDashboardPreview.tsx` when changing:

- preview card composition
- preview metadata chips

## Session Gallery Page

### Purpose

Public page opened from the QR code. It resolves a session token, fetches gallery metadata, and lets the guest preview or download each item.

### Composition

- `SessionGalleryPage`
  - brand header
  - loading state card
  - error state card
  - ready state hero
  - media grid of session items

### Inputs / Dependencies

- `token` from `useParams()`
- `fetchCloudCaptureSessionGallery()` from `src/lib/cloudShare.ts`
- backend routes:
  - `api/capture-sessions/gallery.ts`
  - `api/capture-sessions/media.ts`

Primary style file:

- `src/styles/session-gallery.css`

### State / Modes

- `loading`
- `ready`
- `error`

Photo items render as images.
Boomerang items render as looping videos with controls.
Performance items render as MP4 video cards with a direct `.mp4` download CTA.

### Edit Guide

Edit `SessionGalleryPage.tsx` when changing:

- fetch lifecycle
- token handling
- gallery card composition
- public-facing copy

Do not move expiry/token policy into the page; that belongs to the backend routes.

## Shared Capture Components

### `CapturePreviewTelemetry`

Purpose:
- inline quick settings for mode, countdown, rotation, and flips

Current note:
- the orientation toggle no longer lives here; it now lives in the page header as an icon-only action

### `CaptureSideRail`

Purpose:
- settings button
- shutter button
- fixed multi-state session flow button

Current note:
- long-press on the session button opens inline destructive confirmation
- the button footprint stays constant to avoid shifting the shutter position

### `BrowserSessionOverlay`

Purpose:
- modal overlay for review, upload, QR-ready, and error states

Current note:
- the overlay heading is intentionally minimal now: centered title + description only
- the error overlay heading is aligned to the same vertical axis as the stacked action buttons

### `BrowserSessionFilmStripRail`

Purpose:
- visual occupancy/status of up to four session items
- quick delete of committed items during an active session

Current note:
- no longer owns start/finalize/cancel buttons
- deleting an item from the tray frees a slot so the user can keep shooting up to the session limit of four items
