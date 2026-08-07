# Sony Live SOP

Internal console for Sony staff advising customers on livestream setups —
equipment combos, lighting, OBS routing, an operating checklist, troubleshooting,
a quote builder, and two AI panels.

One app in the Alpha ColorLab monorepo. Deploys from `apps/live-sop`.

**Online only.** There is no desktop build, no installer and no release download.
It is a web app, opened in a browser, and it updates when the page reloads.

## Running it

From the repo root:

```bash
npm run dev -w apps/live-sop
```

Everything else — lint, typecheck, tests, build — runs through the workspace too,
or through `npm run verify` at the root, which gates all three apps at once.

## Routes

| path | what it is |
|---|---|
| `/gear` | equipment combos, the default landing tab |
| `/lighting` | 3-point setup and white balance |
| `/software` | OBS and audio routing |
| `/checklist` | pre-broadcast operating checklist |
| `/trouble` | troubleshooting guide |
| `/faq` | technical Q&A |
| `/pricing` | quote builder, with a printable invoice |
| `/advisor` | AI product advisor |
| `/content-ai` | AI script and caption generator |
| `/showcase` | full-screen live camera showcase, also runs as a kiosk with `?kiosk=1` |

## The AI panels are bring-your-own-key

`/advisor` and `/content-ai` call Gemini with a key the reader pastes into the
settings form, held in their own `localStorage`. With no key they fall back to
canned offline content, which is what a demo without wifi gets.

There is deliberately **no** build-time key. A `VITE_`-prefixed variable is
inlined into the browser bundle, so shipping one would publish it to every
visitor. See `src/lib/gemini.ts`; the key travels in an `x-goog-api-key` header
rather than a query string, so it stays out of proxy logs and browser history.

## Things that will bite you

- **The printable invoice renders on white paper.** Everything inside
  `.printable-invoice-wrapper` in `SmartPricingSystem.tsx` is dark-on-light and
  deliberately excluded from the OKLCH token migration. The print stylesheet also
  targets Tailwind class names directly, so renaming a class inside that block
  breaks the override.
- **Design tokens are generated, not written here.** `src/styles/colorlab-tokens/`
  comes from `packages/colorlab-tokens` via `npm run tokens:emit` at the repo
  root. Editing those files by hand fails `token-drift.test.ts`.
- **`/api/send-quote` only exists as a dev middleware** in `vite.config.ts`. In
  production the quote is written to the reader's own downloads instead. Nothing
  has ever actually sent an email.
- **`react-router` shows two `npm audit` advisories** with no patched release to
  move to. Assessed in [docs/security-notes.md](docs/security-notes.md) — four of
  the five need SSR or RSC, which this app has neither of.
