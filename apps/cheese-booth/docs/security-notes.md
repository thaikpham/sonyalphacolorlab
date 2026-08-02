# Security notes

## `npm audit` reports 2 high advisories against react-router — assessed, no action

`npm audit` flags `react-router` / `react-router-dom` and offers to "fix" by
**downgrading** to 7.11.0. Do not run `npm audit fix --force` on that basis.

There is no patched release to move to. The advisory range is `7.12.0 - 8.2.0`,
`latest` on npm is **7.18.2**, and no stable 8.x exists — the `8.2.0` upper
bound refers to prereleases. Every current release is inside the range, so the
only "fix" npm can offer is going backwards seven minor versions.

### Why this app is not exposed

Five advisories are bundled under the two reported entries:

| Advisory | Applies here? |
|---|---|
| RSC Mode CSRF Bypass (action before 400) | No — this app has no RSC |
| RSCErrorHandler missing protocol validation (XSS) | No — no RSC |
| Arbitrary constructor injection via `deserializeErrors()` in SSR hydration | No — no SSR. `src/main.tsx` uses `createRoot` with `HashRouter`, never `hydrateRoot` |
| Unauthenticated DoS via inefficient route matching | No — route matching happens in the visitor's own browser |
| Open redirect via backslash in `<Link>` / `useNavigate` | Only if a navigation target is attacker-controlled |

The last one is the only client-side issue. Every navigation target in this app
comes from a typed union, never from user input:

- `src/components/CaptureScreen.tsx` — `navigate(getCaptureRoute(profile))` and
  `navigate(getSettingsRoute(profile))`, both built from the `kioskProfiles`
  enum in `src/lib/kioskProfiles.ts`.
- `src/app/KioskExperience.tsx` — `<Navigate to={getCaptureRoute(defaultProfile)}>`, same source.

No route, query parameter or form value reaches a `navigate()` or `<Link to>`.

### When to revisit

Re-run the assessment if any of these become true:

- A stable release above `8.2.0` ships → upgrade and delete this note.
- The app gains SSR or RSC (e.g. moves to a framework) → three of the five
  advisories become live immediately.
- Any navigation target starts coming from user input, a query string, or
  `document.referrer` → the open-redirect advisory becomes live.

Last assessed against `react-router-dom@7.14.0`.
