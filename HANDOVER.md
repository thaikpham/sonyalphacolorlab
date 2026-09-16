# Project Handover Document — Alpha ColorLab 2.0

> **For Claude / AI Coding Assistants**: This document provides a complete summary of all architectural changes, completed features, data refactoring, test suites, and operational directives implemented in this repository.

---

## 1. Executive Summary

Alpha ColorLab 2.0 is a modern Next.js 16 App Router application for exploring, comparing, and sharing Sony Alpha White Balance Shift color recipes, Picture Profiles, Creative Looks, and comprehensive camera/lens specifications.

All 93 Sony products in the catalog (`data/sony-cameras.seed.json`) have been audited against official sources (B&H Photo Video, Sony VN, Sony SG, YL Camera MY) and paired with 1000x1000 high-resolution B&H product photos.

---

## 2. Key Architecture & Completed Features

### A. 1000x1000 High-Res B&H Image Harvester & Orientation Correction
- All 93 products in `data/sony-cameras.seed.json` use official 1000x1000 high-res B&H product image links (`static.bhphoto.com/images/images1000x1000/...`).
- Vertical lens images (`height > width`) were automatically detected, rotated 90° counter-clockwise (CCW) using Pillow, and saved to `public/products/<product-id>.jpg` (e.g. `sony-sel50f14gm.jpg`, `sony-sel85f14gm2.jpg`).
- `fast_image_audit.py` confirmed **0 broken image links** out of 93 products (100% HTTP 200 OK).

### B. Product community drawer — removed

The `/cameras/<id>` pages carried a drawer that read real topics from
`r/sonysandbox_dev`. The whole integration is gone: `src/lib/reddit/`,
`/api/reddit/topics`, `ProductCommunityDrawer`, the `reddit:token` and
`reddit:seed` scripts, the `REDDIT_*` environment contract and the
`cameras.redditStatus.*` / topic message keys. The product page is a single
column of specs and features now.

Nothing replaced it. The recipe-side community — photo uploads and comments on
`/recipe/<slug>`, under the `community` message namespace — is a different
feature on this project's own Supabase tables and is untouched.

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
