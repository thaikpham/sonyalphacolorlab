# The Vercel image optimization quota is spent

This is a live production problem with a bill attached, not a code bug. It is
written down because the symptom is deceptive: the site looks almost fine.

## What is happening

Every request to `/_next/image` that is not already in Vercel's cache returns:

```
HTTP 402
Payment required
OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED
```

The raw files are untouched — `https://www.sonycolorlab.app/logo.png` is a
healthy `200 image/png`. It is only the optimizer that is blocked.

## Why the site still mostly works, and why that is the dangerous part

Transforms produced before the quota ran out are cached and keep serving.
Anything new is not. One file at two widths shows it exactly:

| request | result |
|---|---|
| `/_next/image?url=%2Flogo.png&w=3840&q=75` — the width the page actually uses | **200** |
| `/_next/image?url=%2Flogo.png&w=384&q=75` — a width never generated | **402** |
| `/_next/image?url=%2Flogo.png&w=828&q=75` — a width never generated | **402** |

So the 48 images rendering on the homepage today are not evidence of health.
They are evidence that they were optimized *earlier*. The failure surfaces on:

- **any new recipe photo** — it has no cached variant, so it renders broken
- **a viewport or DPR that picks a srcset width nobody has hit yet**
- **cache eviction** — the currently-working images would go with it

The three ecosystem launcher icons were the first casualties simply because
they were added most recently.

## What has been done in code

Only the launcher icons were fixed, and only because they could be fixed
honestly: they are decorative 256x256 PNGs of 6-11KB, displayed in a ~130px
box. Optimizing something that small saves nothing, so they now carry
`unoptimized` in `src/components/site-header.tsx` and load straight from
`public/`. They are immune to the quota from here on.

**That is not a fix for the site.** Recipe photos come from Supabase Storage at
full resolution and genuinely need resizing; serving those unoptimized would
trade broken images for a slow gallery and a bandwidth bill.

## The options, none of which are free

1. **Raise the plan or buy image optimization.** Simplest, keeps `next/image`
   exactly as it is. Recurring cost.
2. **Move recipe photos to Supabase's own image transformation.** Supabase
   Storage can resize on its own render endpoint, which moves the cost to a
   service you already pay for. Requires a custom `loader` in `next.config.ts`
   and re-checking `images.remotePatterns`.
3. **Pre-generate sizes at build time.** `npm run seed:emit` already walks every
   recipe; it could emit a fixed set of widths and store them next to the
   originals. No per-request optimization at all, but a slower build and a
   larger bucket.
4. **`images: { unoptimized: true }` globally.** Cheapest to implement, worst
   outcome — full-resolution photos into a phone gallery.

Option 2 is the best fit for this project: the images already live in Supabase,
the bucket is public, and it removes the dependency on a Vercel quota entirely.

Whichever is chosen, decide before adding recipes. A photo uploaded today
renders broken today, and nothing in the build or the test suite will say so —
`npm run verify` passes on all 389 tests with the site in this state.
