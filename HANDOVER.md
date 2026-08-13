# Project Handover Document — Alpha ColorLab 2.0

> **For Claude / AI Coding Assistants**: This document provides a complete summary of all architectural changes, completed features, data refactoring, test suites, and operational directives implemented in this repository.

---

## 1. Executive Summary

Alpha ColorLab 2.0 is a modern Next.js 16 App Router application for exploring, comparing, and sharing Sony Alpha White Balance Shift color recipes, Picture Profiles, Creative Looks, and comprehensive camera/lens specifications.

All 93 Sony products in the catalog (`data/sony-cameras.seed.json`) have been audited against official sources (B&H Photo Video, Sony VN, Sony SG, YL Camera MY), paired with 1000x1000 high-resolution B&H product photos, and wired to real discussion topics on **`r/sonysandbox_dev`**.

---

## 2. Key Architecture & Completed Features

### A. 1000x1000 High-Res B&H Image Harvester & Orientation Correction
- All 93 products in `data/sony-cameras.seed.json` use official 1000x1000 high-res B&H product image links (`static.bhphoto.com/images/images1000x1000/...`).
- Vertical lens images (`height > width`) were automatically detected, rotated 90° counter-clockwise (CCW) using Pillow, and saved to `public/products/<product-id>.jpg` (e.g. `sony-sel50f14gm.jpg`, `sony-sel85f14gm2.jpg`).
- `fast_image_audit.py` confirmed **0 broken image links** out of 93 products (100% HTTP 200 OK).

### B. Product Community Drawer — real topics from `r/sonysandbox_dev`

`src/lib/reddit/` is the whole integration; `ProductCommunityDrawer`
(`src/components/product-community-drawer.tsx`) is its only UI.

- **Every number on screen is Reddit's.** Score, comment count, author, mod and
  pin state are read from the API. There is no local vote and no local post
  list: acting on a post is an action on Reddit under the reader's own account,
  so each card links out for it instead of simulating it.
- **The mockups are gone.** `src/lib/cameras/community.ts` held five authored
  placeholder topics for the a7 IV and a per-product handle (`r/7iv-sev`) that
  does not exist on reddit.com. Both are deleted. A space that cannot be read
  now says so — see the `redditStatus.*` banner — rather than showing a
  realistic-looking feed.
- Filter tabs (`✨ Mới nhất`, `🔥 Hot`, `🎨 Recipe Màu`, `📸 Ảnh chụp mẫu`,
  `❓ Hỏi đáp`), fullscreen mode and the >140-character `Xem thêm…` expansion are
  unchanged.

### C. How a post is bound to a product

The canonical product URL in the post body — `…/cameras/<product-id>` — appended
by `composeBody()` and read back by `productIdOf()` (`src/lib/reddit/topics.ts`).
It is a link a human reader wants anyway, it survives editing and crossposting,
and it needs no per-product flair. `topics.test.ts` pins the two as inverses,
because if they drift the post is silently dropped from every feed with no error
to see.

The server reads `/r/<sub>/new?limit=100` once and caches it for 60s, then
filters in memory. Reddit's search endpoint is the scalable shape but its index
lags minutes behind a submission, and a reader who posts and does not see their
own topic reads that as a bug.

### C2. Two write paths, and why

- **Readers hand off to Reddit** (`submitUrl()` in `src/lib/reddit/config.ts`).
  The drawer opens reddit.com's own compose page pre-filled; the reader presses
  Post as themselves. No server route posts on a reader's behalf — that would
  put one account's name on prose someone else typed, the same trap
  `identity-not-from-body.test.ts` pins for the community tables.
- **The project posts as itself** via `npm run reddit:seed -- <product-id>`,
  dry by default, `--post` to submit. This is the only user of the bot token.

### C3. Credentials

`r/sonysandbox_dev` is a **private** Devvit playtest sub, so reading it needs a
refresh token belonging to an account that is a member — an app-only
(`client_credentials`) token is refused. Mint one with `npm run reddit:token`
after creating a **web app** at `https://www.reddit.com/prefs/apps` with redirect
URI `http://localhost:8080/callback`. Vars are documented in `.env.example`.
Without them the drawer reports `notConfigured` and shows nothing.

### D. Dedicated Individual Product Routes (`/cameras/[id]`)
- Created `src/app/[locale]/cameras/[id]/page.tsx`:
  - Pre-renders static pages for all 93 products across `en` and `vi` via `generateStaticParams()`.
  - Shareable URLs (e.g. `http://localhost:3000/vi/cameras/sony-ilce-7m4-bq-ap2`).
  - Dynamic OpenGraph SEO metadata (`generateMetadata()`).
  - Browser URL history `pushState` on catalog modal open for seamless deep-linking.

### E. Ultra High-Contrast Typography Upgrade
- All dark/muted low-contrast text (`text-white/40`, `text-white/60`, `text-gray-400`) was replaced with high-contrast, ultra-readable typography:
  - Body text: `text-slate-100 font-medium leading-relaxed`.
  - Titles: `text-white font-extrabold`.
  - Timestamps & Badges: `text-amber-300 font-bold`, `text-sky-300 font-bold`.
  - Input placeholders: `placeholder:text-slate-300 text-white font-medium`.

---

## 3. Data & Schema Refactoring

### Lens Specs Refactoring
- Removed `construction` (Cấu trúc quang học) field from `LensSpecs` in `src/lib/cameras/types.ts`.
- Removed `'construction'` from `SPEC_ROWS.lens` in `src/components/product-detail-modal.tsx`.
- Removed `construction` from `specs` and `specsMissing` across all 57 lens records in `data/sony-cameras.seed.json`.

### Multi-Source Audit
- Audited EVF and LCD fields for Cinema Line & Vlog bodies (FX3, FX30, FX6, ZV-1, ZV-E10, FR7) with explicit indicators (`Không có`).
- Set `specsMissing: []` across 100% of all 93 products in `data/sony-cameras.seed.json`.

---

## 4. Verification & Testing

Every commit and update strictly satisfies `npm run verify`:

```bash
npm run verify
```

### Test Pass Rate
- **ESLint**: Passed 100% (0 errors, 0 warnings).
- **TypeScript (`tsc --noEmit`)**: Passed 100% (0 errors).
- **Vitest Unit Tests**: **824 / 824 unit tests passed (100%)**.

---

## 5. Important Project Rules (Rule Checklist)

1. **Rule 1 — Never write a camera value from memory**: Import from `src/lib/camera/constants.ts`.
2. **Rule 2 — A recipe is exactly one format**: Picture Profile (`pp`) and Creative Look (`cl`) are mutually exclusive.
3. **Rule 3 — Translate UI copy, never technical terms**: All user-visible strings must be in `messages/*.json`. Technical values stay in `constants.ts`.
4. **Rule 7 — Localhost Dev Server Auto-Restart**: Always restart `npm run dev` in daemon mode after completing code/data updates so the user can preview immediately at `http://localhost:3000`.

---

## 6. Active Dev Server URLs

- **Vietnamese Catalog**: `http://localhost:3000/vi/cameras`
- **English Catalog**: `http://localhost:3000/en/cameras`
- **Product Detail Route Sample**: `http://localhost:3000/vi/cameras/sony-ilce-7m4-bq-ap2`
