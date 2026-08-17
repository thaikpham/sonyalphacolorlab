# ColorLab 2.0 Performance and Vercel Usage Design

**Date:** 2026-08-17  
**Status:** Approved in chat; pending implementation plan  
**Scope:** Alpha ColorLab only

## 1. Context

The Vercel usage screenshot is aggregated across several projects in the same
account. This design cannot attribute all account usage to ColorLab and does
not change CheeseBooth, Sony Live SOP, or Sony Livestream Showcase. It targets
the ColorLab costs and performance issues confirmed by a read-only production
and source audit.

Confirmed production baseline:

- Public localized HTML routes are emitted as dynamic (`ƒ`) routes.
- Repeated requests to `/`, `/vi`, recipe pages, `/cameras`, and `/colorlab`
  return `Cache-Control: private, no-store`, `x-vercel-cache: MISS`, and execute
  in `iad1` with observed warm-ish TTFB around 0.5 seconds from Vietnam.
- A 15-second log window contained 750 successful recipe-page GETs. Every
  sampled recipe path was requested 15 times and every response was a cache
  miss. The request shape is automated, but the available logs do not expose
  enough identity data to classify the caller safely.
- A recipe page immediately starts three public read requests: comments,
  proposals, and community photos.
- The 83 recipe cards use default Next.js link prefetch. A production RSC
  prefetch was confirmed to be a function cache miss.
- Predictive search calls an API after 120 ms and independently changes the
  server route after 250 ms, duplicating catalogue reads.
- `/api/cameras/ai-specialist` calls the paid model without authentication,
  shared rate limiting, a fleet-wide spend cap, or bounded request input.
- The project has no Vercel WAF custom rules.
- `logo.png` is about 171 KB, is preloaded by the header, and is served with
  browser revalidation instead of a fingerprinted immutable URL.
- The camera comparison route serializes the full camera catalogue into its
  initial client payload.

Cloudflare Speed Brain is enabled on the custom domain, but it is not treated
as an origin-load cause. Its speculative prefetch safeguard only serves
Cloudflare-cached content and does not forward a cache miss to the origin.

## 2. Root Cause

`src/app/layout.tsx` calls `getLocale()` to set `<html lang>`. At that point the
child `[locale]` layout has not established a locale with
`setRequestLocale(locale)`, so next-intl resolves the locale from request
headers. That request-header access opts the whole localized route tree into
dynamic rendering.

The production build confirms the result: localized HTML routes are dynamic,
even though their static parameters are enumerated. The resulting public page
misses multiply the cost of normal navigation, Next.js prefetch, automated
traffic, and uncached Supabase reads.

## 3. Goals

1. Serve public HTML from Vercel's static/full-route cache instead of invoking
   a Function for every page view.
2. Reduce Edge Requests by eliminating speculative requests that provide
   little value and by rate-limiting confirmed abusive request shapes safely.
3. Reduce public read APIs from eager, repeated calls to deferred, shared,
   cacheable reads.
4. Eliminate server work per search keystroke.
5. Require a verified user for paid AI and enforce atomic per-user and
   fleet-wide budgets.
6. Reduce initial image, RSC, JavaScript, and catalogue payloads without
   changing the visual design or camera data.
7. Preserve bilingual routing, legacy URLs, Supabase fallback behavior,
   realtime community updates while visible, accessibility, and SEO metadata.

## 4. Non-goals

- No migration to Cache Components/PPR in this work. The repository does not
  currently enable Cache Components, and the static-first design solves the
  observed problem with less risk.
- No new database, cache provider, analytics product, or reverse proxy.
- No Cloudflare HTML `Cache Everything` rule. Next.js RSC responses vary by
  router headers, so an extra HTML cache layer would require a separate safety
  design.
- No design-system refresh, camera constant changes, recipe edits, or unrelated
  component refactor.
- No automatic production firewall publish or Supabase migration apply. Those
  external changes retain explicit review gates.

## 5. Chosen Architecture

The chosen approach is a layered, static-first remediation. It fixes the
dynamic-rendering root cause before optimizing downstream calls.

### 5.1 Rendering and i18n

Promote `src/app/[locale]/layout.tsx` to the root layout for localized pages:

- It owns `<html>` and `<body>` and sets `lang` directly from validated route
  params.
- It calls `setRequestLocale(locale)` before any next-intl server API.
- The request-derived `getLocale()` root layout is removed.
- `HtmlLang` remains as a client-side safety net if a locale transition does
  not replace the document element.
- Root metadata routes and API routes remain independent of the localized root
  layout.

Next.js 16 explicitly supports a root layout under a top-level dynamic segment.
The implementation must verify invalid-locale and not-found rendering after the
move; it must not restore request-header locale resolution as a workaround.

Public routes that currently read `searchParams` on the server are redesigned:

- `/colorlab` renders the full public recipe-card data from cached server data,
  then applies query, tag, and format filters in a Client Component.
- The client synchronizes filters with `history.replaceState`, not a Next
  router navigation, so typing does not request another RSC payload.
- A direct URL containing filters may render the unfiltered static HTML until
  hydration applies the URL state. This brief transition is accepted in favor
  of retaining a static route and complete crawlable catalogue HTML.
- `/cameras/compare` becomes a static shell. Its Client Component reads `ids`
  from the URL and loads one locale-specific, cacheable catalogue document on
  demand instead of receiving the complete catalogue in every RSC response.
- Both Client Components isolate `useSearchParams` below a Suspense boundary so
  the surrounding page remains statically rendered.

Expected route classification after the change:

- Public launcher, catalogue, recipe, camera product, compare, and audio routes:
  static/SSG/ISR.
- Mutating APIs, authenticated reads, and AI routes: dynamic by design.
- Admin UI is a static shell; its authenticated API operations remain dynamic
  and uncached.

### 5.2 Catalogue data cache and invalidation

Continue supporting Supabase in production and seed JSON offline. Add a
persistent, tagged cache around public Supabase reads using the Next.js 16 API
documented for projects without Cache Components.

Cache domains are deliberately separate:

- `recipes` and `recipe:<slug>`
- `cameras` and `camera:<id>`
- `audio`
- `search-index:<locale>`

Arguments such as locale, slug, and filters are part of the cache key. Every
public read changed by this work uses an explicit projection rather than
`select('*')`. Metadata generation and page rendering share the same cached
value. Catalogue caches revalidate after one hour as a safety net in addition
to explicit tag invalidation.

Admin writes invalidate the affected entity and collection tags only after a
successful database write. If invalidation fails after the row is committed,
the API returns `202` with `revalidationPending: true`; the admin UI states that
the data was saved but propagation is delayed. This avoids falsely reporting a
failed write and triggering a duplicate retry. When Supabase reads fail,
existing seed fallback remains available for catalogue pages; paid AI fails
closed if its shared quota store is unavailable.

### 5.3 Search and dense navigation

Replace per-prefix predictive requests with one compact search index per
locale:

- The index contains only fields needed for matching and result display.
- It is fetched on the first search focus and reused for the session.
- Filtering and ranking run locally after the index arrives.
- `GET /api/search/index/[locale]` uses the persistent tagged data cache and a
  public CDN policy of one hour with 24-hour stale-while-revalidate. Recipe and
  camera writes invalidate it.
- Queries shorter than two trimmed characters do not fetch the index.

Disable automatic prefetch on recipe cards and other dense catalogue links.
Normal navigation remains unchanged. Prefetch remains enabled only on sparse
top-level launcher/header navigation, not repeated grids or result lists.

The next-intl Proxy stays in place for as-needed English routing. The design
does not skip locale middleware for RSC requests without proving bare English
and prefixed Vietnamese behavior end to end.

### 5.4 Deferred community and Reddit reads

Keep the authored recipe gallery in the initial render. Move community data to
one lazy client boundary that starts when the gallery/community area approaches
the viewport.

One public community payload returns:

- approved community photos and display credits;
- public comments;
- public proposal fields and aggregate vote counts.

The response names safe columns explicitly and never includes email addresses
or voter identity. `GET /api/community/[slug]` uses `s-maxage=60` and
`stale-while-revalidate=300`.
Authenticated vote status is a separate private request made only after the
section is visible and a verified session exists.

The gallery and community UI share one in-flight request and one client cache,
so approaching both boundaries does not duplicate the payload. Realtime
subscriptions exist only while the community section is mounted. A successful
local write updates the current UI immediately and invalidates the public
community data; other readers may see the change for at most the five-minute
stale-while-revalidate window.
Realtime events update local state directly where the payload is sufficient;
otherwise they trigger at most one explicit refresh.

The Reddit product-community drawer does not fetch until opened. Its public
result uses `s-maxage=300` and `stale-while-revalidate=3600`, so a cold region or
new Function instance does not repeat the upstream request for every product
view.

### 5.5 Paid AI protection

Both `/api/tweak` and `/api/cameras/ai-specialist` require `requireUser(request)`
before model invocation. Caller identity comes from the verified Supabase JWT,
never from the request body.

The AI Specialist body uses a strict schema:

- `productIds`: 1 to 6 known product IDs;
- `question`: 3 to 500 characters;
- `locale`: `en` or `vi`;
- unknown keys are rejected.

The existing Tweak schema remains strict and bounded. Both routes consume a
shared, atomic Supabase quota before calling Anthropic:

- default per user and endpoint: 5 requests per fixed UTC minute;
- default per user across paid AI: 25 requests per UTC day;
- default fleet cap across paid AI: 100 requests per UTC day;
- environment variables may lower or raise these defaults intentionally.

The quota table and atomic database function are accessible to the service role
only. The database operation must increment/check in one transaction so
parallel instances cannot exceed the cap through races. If Supabase or the
quota function is unavailable, paid model calls return `503` and do not fall
back to the current in-process counter.

Responses are consistent:

- `401` for anonymous callers;
- `400` for invalid input;
- `429` plus `Retry-After` for a user or fleet quota;
- `503` for unavailable quota infrastructure;
- `502` for a sanitized upstream model failure.

As defense in depth, stage Vercel WAF rules in log mode:

- paid AI POST routes: observe 30 requests/minute/IP;
- recipe GET routes: observe 120 requests/minute/IP to catch the confirmed
  high-rate scan shape.

The rules remain unpublished or log-only until their filtered traffic is
reviewed. Enforcement is tested in Preview first, then requires an explicit
production publish. Application authentication and atomic quotas remain the
primary AI protection even if the Vercel plan cannot enforce WAF rate limits.

### 5.6 Images, assets, and client payload

- Replace the header logo with a visually verified, fingerprinted local asset
  sized for its rendered dimensions, with a target of at most 20 KB. Remove
  unconditional priority/preload from ordinary internal pages.
- Keep the custom image loader, which already avoids Vercel Image
  Transformations. Adjust its B&H 500/1000-pixel selection and the Next image
  width ladder so card layouts do not request the 1000-pixel source when the
  500-pixel source satisfies the rendered size. Add the actual five/six-column
  breakpoints to `sizes`.
- Preserve the original image only for an explicit lightbox interaction.
- Do not serialize the full camera catalogue into the initial compare RSC
  payload. Load the cached catalogue after the compare shell mounts.
- Lazy-load the Community, Reddit, comparison tool, and AI interaction code at
  the point each feature can be used. Core recipe settings, authored photos,
  product identity, navigation, and accessibility content remain in the first
  render.
- Split expensive search overlay logic from the always-mounted header where it
  can be done without changing header behavior.

### 5.7 Metadata and redirects

Generate OG and Twitter image URLs in the canonical locale shape. English uses
the bare `/recipe/<slug>/opengraph-image` URL; Vietnamese keeps `/vi/...`.
Fetching the metadata URL must return the image directly without a locale
redirect.

Legacy query-parameter redirects remain compatible. Redirect-chain cleanup is
limited to hops controlled by this repository; canonical-domain behavior at
Cloudflare/Vercel is verified separately before any external change.

## 6. Error and Loading UX

- Lazy sections render a stable translated placeholder/skeleton with reserved
  space to avoid layout shift.
- Community and Reddit errors show a retry action and do not fail the recipe or
  product page.
- A stale cached public read is preferred to a blank section during a transient
  upstream failure.
- AI authentication opens the existing sign-in flow. Rate-limit and service
  errors use translated, actionable messages and do not expose provider text.
- Failed catalogue cache revalidation never deletes the last good cached/seed
  value.

All new user-visible copy is added to both message catalogues. Technical labels
remain untranslated according to repository rules.

## 7. Testing Strategy

Implementation follows TDD. Each behavior is pinned before production code.

### 7.1 Unit and component tests

- Root layout receives locale from params and contains no request-derived
  `getLocale()`, `headers()`, or `cookies()` access.
- Invalid locale and EN/VI `<html lang>` behavior.
- Catalogue cache keys, tag invalidation, seed fallback, and no duplicate
  metadata/page data read.
- Search index projection and ranking; typing after index load performs no
  fetch and no router navigation.
- Dense recipe links have automatic prefetch disabled.
- Intersection-driven community loading performs zero initial GETs, one shared
  GET on entry, and no duplicate request for gallery/community consumers.
- Anonymous vote state is not requested; authenticated vote state is private.
- Reddit performs no request before opening and one request after opening.
- AI routes reject anonymous, oversized, malformed, and unknown-key requests
  before Anthropic is called.
- Atomic quota tests cover concurrent increments, UTC rollover, per-user caps,
  fleet caps, `Retry-After`, and fail-closed database errors.
- Migration tests prove the quota SQL on PGlite and prove anon/authenticated
  roles cannot select or mutate quota rows.
- Image-loader tests use rendered-width cases and prevent accidental 1000-pixel
  selection for small cards.
- Asset-budget test caps the fingerprinted logo size.
- Existing email-leak, identity, translation parity, token drift, accessibility,
  camera schema, and migration tests remain green.

### 7.2 Build and browser verification

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run verify`

The local desktop sandbox currently prevents Turbopack from binding its internal
port; this is an environment limitation, not an accepted build waiver. The
final implementation still requires a successful production-equivalent build,
using a Vercel Preview build if the local restriction remains.

Browser verification on Preview covers:

- locale switching, direct EN/VI loads, invalid locale, and not-found pages;
- legacy query redirects and canonical metadata;
- search/filter URL persistence without RSC traffic per keystroke;
- initial recipe waterfall, deferred community, realtime updates, and votes;
- authenticated and anonymous AI flows;
- compare deep links and add/remove navigation;
- image candidate selection at mobile, desktop, and 5/6-column widths;
- keyboard navigation, headings, focus, and reduced-motion behavior.

### 7.3 Production acceptance checks

After an approved deployment:

1. The build route table marks public localized routes static/SSG/ISR rather
   than dynamic.
2. A cold request may be `MISS`; repeated canonical HTML requests become
   `HIT` or `STALE`, have positive `Age`, and are not `private, no-store`.
3. A recipe page starts no Community API request before its lazy boundary and
   issues at most one public community request when activated.
4. Typing a ten-character search creates no per-character API or RSC requests.
5. Anonymous AI calls return `401`; accepted signed-in calls consume one atomic
   quota unit; concurrent calls cannot exceed configured caps.
6. The OG URL emitted by an English recipe returns `200` without a locale
   redirect.
7. The header logo is at most 20 KB and does not revalidate as `/logo.png` on
   ordinary navigation.
8. No public response exposes an email or private vote/quota data.

Vercel route-level billing totals cannot be established without the account's
Observability feature. Success is therefore first proven by route
classification, cache headers, request waterfalls, and Function logs. Account
usage is compared over the next complete billing window when available.

## 8. Rollout and Recovery

Implementation is delivered in independently verifiable layers:

1. AI authentication, validation, and shared quota migration.
2. Localized root-layout/static-rendering correction.
3. Catalogue cache, invalidation, static filters, and search index.
4. Deferred/aggregated Community and Reddit reads.
5. Image, logo, compare payload, and lazy-bundle reductions.
6. Metadata redirect cleanup and staged WAF observation rules.

Each layer must pass the relevant tests before the next. A Preview deployment
is exercised before production promotion. WAF rules follow log -> traffic
review -> Preview enforcement -> explicit production publish. The Supabase
migration is tested in CI but applied separately with explicit approval.

Rollback favors small reversals:

- Revert the latest application deployment if static routing or authentication
  regresses.
- Disable or return WAF rules to log mode before changing application code.
- Keep the quota migration additive; rollback application code without dropping
  usage history.
- Restore eager UI mounting independently if a lazy-boundary regression appears,
  without undoing static rendering or AI protection.

## 9. Expected Impact

The static root-layout fix removes a Function invocation and repeated Supabase
catalogue work from ordinary public page views. Disabling dense prefetch and
eliminating per-keystroke server navigation reduces request count. Deferred,
aggregated community reads change a recipe view from three immediate Functions
to zero before engagement and one shared read after engagement. Authenticated,
atomic AI quotas turn an unbounded cost endpoint into a controlled budget.

Exact percentage savings are intentionally not promised from the account-level
screenshot. The design supplies measurable route-level acceptance criteria so
the reduction can be verified without inventing attribution.
