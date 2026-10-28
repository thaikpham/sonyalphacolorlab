# Reading pages and copy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones, a recipe's settings come straight after its hero and an article's outline folds under its dek; five leftover copy items are cut to one sentence + one action.

**Architecture:** Source order is reading order: the recipe page's grid gets three children (hero, settings, participation) placed into today's two desktop columns with explicit grid lines; the article view switches from a wrapping flex row to `flex-col` → `lg:flex-row`, with one outline component rendered in the rail (lg+) and in a closed `<details>` under the dek (below lg). Copy changes live in `messages/*.json` and the three components that render them.

**Tech Stack:** Next 16 App Router, React 19 server components, Tailwind v4, next-intl, vitest (source-assertion tests, no DOM), Playwright gates.

Spec: `docs/superpowers/specs/2026-10-28-reading-pages-design.md`.

## Global Constraints

- Branch `claude/reading-pages`, repo `/home/thaikpham/Desktop/ColorLab 2.0`. Commit on top of HEAD; no rebase/amend/worktree. Do not push.
- `.env.local` holds LIVE Supabase credentials: never `next start`/`next build` with them except `npm run verify`; never `push:*`, `content:import`, `supabase:migrations --apply`; never `rm -rf .next` (only `.next/dev`); never start `next dev` through Bash (to look at a page, use the built-in browser's `preview_start` with `{"name":"alpha-colorlab-offline"}`).
- Design rules (CLAUDE.md): 13px floor, no strokes (`border`/`ring`/`outline` only on `:focus-visible`), no transitions except existing ones, no `duration-*`, touch targets ≥ 44px (`min-h-[var(--layout-touch-target)]`), no explanatory microcopy, every user-visible string in `messages/en.json` and `messages/vi.json`.
- `npm test`, `npm run typecheck`, `npm run lint; echo $?` (never piped) before each commit. `src/design/floor.test.ts` is an exact baseline: a drop is recorded with `npm run design:baseline`, a rise is fixed.
- Budgets only go down; a lowered number carries the date `2026-10-28`.
- Do not edit `CLAUDE.md`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Recipe page — settings second in source order

**Files:**
- Modify: `src/app/[locale]/recipe/[slug]/page.tsx:173-309` (the two-column grid)
- Test: `src/app/recipe-page.test.ts`

**Interfaces:** none shared. The three grid children carry `data-part="hero" | "settings" | "participation"` (the tests' anchors).

- [ ] **Step 1: Write the failing tests**

In `src/app/recipe-page.test.ts`, inside `describe('the settings column', …)`, replace the gap assertion in the first case:

```ts
    expect(page).toContain('lg:gap-8 xl:gap-12');
```

with

```ts
    /* Column gap only from xl: the grid's ROW gap is now what separates
       the hero from the gallery below it, and that stayed 2rem. */
    expect(page).toContain('gap-8 xl:gap-x-12');
```

and add a new block after that `describe`:

```ts
describe('the order a phone reads', () => {
  /* On a phone the grid is one column, so source order is reading order.
     It was hero → gallery → AI → community → white balance → settings: the
     settings, the reason to open a recipe, started on screen 3 of 6. */
  it('puts the settings straight after the hero, before the gallery, AI and community', () => {
    const at = (part: string) => page.indexOf(`data-part="${part}"`);
    expect(at('hero')).toBeGreaterThan(-1);
    expect(at('settings')).toBeGreaterThan(at('hero'));
    expect(at('participation')).toBeGreaterThan(at('settings'));
    for (const tag of ['<RecipeGallery', '<TweakPanel', '<RecipeCommunitySection']) {
      expect(page.indexOf(tag)).toBeGreaterThan(at('participation'));
    }
    expect(page.indexOf('<WbPlane')).toBeGreaterThan(at('settings'));
    expect(page.indexOf('<WbPlane')).toBeLessThan(at('participation'));
  });

  /* Desktop keeps its two columns: hero over participation on the left,
     settings on the right across both rows. `auto 1fr` sends any height the
     spanning column adds to the second row, under the participation block,
     so no gap opens between the hero and the gallery. */
  it('places the three parts back into the desktop columns', () => {
    expect(page).toContain('lg:grid-rows-[auto_1fr]');
    expect(page).toMatch(/data-part="hero"\s+className="[^"]*lg:col-start-1 lg:row-start-1\b/);
    expect(page).toMatch(/data-part="participation"\s+className="[^"]*lg:col-start-1 lg:row-start-2\b/);
    expect(page).toMatch(
      /data-part="settings"\s+className="[^"]*lg:col-start-7 xl:col-start-8 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24/,
    );
  });
});
```

Before writing, check the real name of the white-balance plane component in `page.tsx` (the element inside the `<section className="surface p-5">` that opens the settings column) and use it in place of `<WbPlane` in both lines.

- [ ] **Step 2: Run, expect RED**

Run: `npx vitest run src/app/recipe-page.test.ts`
Expected: the gap case and both new cases FAIL (no `data-part`, old gap string).

- [ ] **Step 3: Restructure the grid**

In `page.tsx`, the grid container becomes:

```tsx
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_1fr] gap-8 xl:gap-x-12 items-start">
```

The current left column `<div className="lg:col-span-6 xl:col-span-7 flex flex-col gap-8">` is split: its first child (the recipe header/description block, through the taxonomy links) moves into

```tsx
          <div data-part="hero" className="lg:col-span-6 xl:col-span-7 lg:col-start-1 lg:row-start-1 flex flex-col gap-8">
            {/* … the header block, unchanged … */}
          </div>
```

then the right column follows, unchanged inside, with its opening tag replaced by

```tsx
          <div data-part="settings" className="lg:col-span-6 xl:col-span-5 lg:col-start-7 xl:col-start-8 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24 flex flex-col gap-6">
```

then the gallery, AI panel and community section, unchanged, in

```tsx
          <div data-part="participation" className="lg:col-span-6 xl:col-span-7 lg:col-start-1 lg:row-start-2 flex flex-col gap-8">
            <RecipeGallery … />
            <TweakPanel … />
            <RecipeCommunitySection … />
          </div>
```

Keep every existing comment with the code it describes; update the two comments that say "Left Column" / "Right Column" so they describe the three parts and why the settings are second in source order (one or two sentences, the reason from the test). Nothing else on the page changes.

- [ ] **Step 4: Run, expect GREEN; full suite**

Run: `npx vitest run src/app/recipe-page.test.ts` → PASS. Then `npm test`, `npm run typecheck`, `npm run lint; echo $?` → all 0.

- [ ] **Step 5: Look at it**

`preview_start` `{"name":"alpha-colorlab-offline"}`, open a recipe page (any `/recipe/<slug>` from `/colorlab`). At 375 wide (`resize_window` preset `mobile`): White Balance follows the taxonomy links. At 1440×900 and 1024×768: hero top-left, settings top-right and sticky on scroll, gallery directly under the hero with the same spacing as before. Screenshot both; reset the viewport (`preset: desktop`); stop the preview.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/recipe/[slug]/page.tsx" src/app/recipe-page.test.ts
git commit -m "Recipe page: the settings come straight after the hero on a phone; desktop keeps its columns"
```

---

### Task 2: Article page — the outline folds under the dek below lg

**Files:**
- Modify: `src/components/lab/article-view.tsx:97-262`
- Create: `src/components/lab/article-view.test.ts`

**Interfaces:** an in-file server component `OutlineList({ outline }: { outline: ReturnType<typeof buildOutline> })` rendering the `<ul lang={ARTICLE_LANG}>` the rail renders today; used by the rail and by the folded block.

- [ ] **Step 1: Write the failing tests**

`src/components/lab/article-view.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The article page's two layouts, as source assertions (no DOM here). Below
 * lg the outline used to sit ABOVE the h1 — the rail wrapped over the article
 * — so a phone reader met the table of contents before the title.
 */
const view = readFileSync('src/components/lab/article-view.tsx', 'utf8');

describe('the article layout', () => {
  it('is one column below lg and two from lg, switched at the breakpoint, not by wrapping', () => {
    expect(view).not.toContain('flex-wrap-reverse');
    expect(view).toMatch(/className="flex flex-col lg:flex-row lg:items-start/);
    /* flex-basis on the main axis: in a column it would be a 32.5rem HEIGHT. */
    expect(view).toContain('lg:flex-1 lg:basis-[32.5rem]');
    expect(view).not.toMatch(/(?<!lg:)basis-\[32\.5rem\]/);
  });

  it('hides the rail below lg and keeps it sticky from lg', () => {
    expect(view).toMatch(/aria-label=\{t\('railLabel'\)\}\s+className="hidden lg:flex[^"]*lg:sticky lg:top-6/);
  });

  it('folds the outline under the dek below lg, closed, behind a 44px summary', () => {
    const dek = view.indexOf('{article.dek}');
    const fold = view.indexOf('<details');
    const firstBlock = view.indexOf('article.blocks.map(');
    expect(fold).toBeGreaterThan(dek);
    expect(fold).toBeLessThan(firstBlock);
    expect(view).not.toMatch(/<details[^>]*\sopen/);
    expect(view).toMatch(/<summary[^>]*min-h-\[var\(--layout-touch-target\)\]/);
    expect(view.slice(dek, fold)).toContain('lg:hidden');
  });

  it('renders the read-first links open in the phone block, before the fold', () => {
    const phone = view.indexOf('lg:hidden');
    const readFirst = view.indexOf("heading={tl('readFirst')}", phone);
    expect(readFirst).toBeGreaterThan(phone);
    expect(readFirst).toBeLessThan(view.indexOf('<details'));
  });

  it('draws the outline from one component in both places', () => {
    expect(view.match(/<OutlineList outline=\{outline\} \/>/g)).toHaveLength(2);
    expect(view.match(/outline\.map\(/g)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run, expect RED**

Run: `npx vitest run src/components/lab/article-view.test.ts` → all five FAIL.

- [ ] **Step 3: Implement**

In `article-view.tsx`:

1. Add, below `renderBlock`, the shared list (moved verbatim from the rail):

```tsx
/** The article's sections, numbered, each with its précis — the rail's list
    from lg up, the folded list under the dek below it. */
function OutlineList({ outline }: { outline: ReturnType<typeof buildOutline> }) {
  return (
    <ul lang={ARTICLE_LANG} className="mt-1">
      {outline.map((entry) => (
        <li key={entry.id}>
          <hr className="seam" />
          <a
            href={`#${entry.id}`}
            className="flex min-h-[var(--layout-touch-target)] gap-2.5 rounded-sm px-2 py-3 transition-colors hover:bg-glass"
          >
            <span className="text-label font-bold tabular-nums text-accent-400">{entry.n}</span>
            <span className="min-w-0">
              <span className="block text-body-sm font-semibold leading-[1.35] text-ink">{entry.text}</span>
              {entry.precis ? <span className="meta mt-1 block leading-[1.45]">{entry.precis}</span> : null}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
```

2. The container: replace `className="flex flex-wrap-reverse items-end gap-y-8 gap-x-[clamp(2rem,3.5vw,4rem)]"` with `className="flex flex-col lg:flex-row lg:items-start gap-y-8 gap-x-[clamp(2rem,3.5vw,4rem)]"`, and rewrite the long comment above it to say: one column below `lg` with the outline folded under the dek; two columns from `lg`, rail beside the text. (The `wrap-reverse` / `items-end` explanation goes, since neither is used.)

3. The `<article>`: `min-w-0 max-w-[46rem] flex-1 basis-[32.5rem]` → `min-w-0 max-w-[46rem] lg:flex-1 lg:basis-[32.5rem]`.

4. After the dek `<p>` and before `<hr className="seam mt-8 mb-8" />`, inside the `lang={ARTICLE_LANG}` div — the phone block. It is navigation in the reader's UI language, so it resets `lang` to the page's:

```tsx
          {prerequisites.length > 0 || outline.length > 0 ? (
            <nav aria-label={t('railLabel')} lang={locale} className="mt-8 flex flex-col gap-5 lg:hidden">
              {prerequisites.length > 0 ? (
                <RelatedLinks links={prerequisites} heading={tl('readFirst')} lang={ARTICLE_LANG} />
              ) : null}
              {outline.length > 0 ? (
                <details className="group">
                  <summary className="label flex min-h-[var(--layout-touch-target)] cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                    {knowledge ? tl('inThisPage') : t('inThisArticle')}
                    <span aria-hidden className="text-ink-faint group-open:rotate-180">▾</span>
                  </summary>
                  <OutlineList outline={outline} />
                </details>
              ) : null}
            </nav>
          ) : null}
```

5. The rail `<nav>`: className → `hidden lg:flex lg:sticky lg:top-6 shrink-0 basis-[clamp(15rem,19vw,20rem)] flex-col gap-5`; remove `self-end`, `grow`, `lg:grow-0`; its outline `<ul>…</ul>` becomes `<OutlineList outline={outline} />`. Rewrite its comments: the `self-end`/`grow` explanation goes; the prerequisites comment says the rail is the lg+ home of "read first", and the phone block under the dek is the other.

- [ ] **Step 4: Run, expect GREEN; full suite**

Run: `npx vitest run src/components/lab/article-view.test.ts` → PASS; then `npm test`, `npm run typecheck`, `npm run lint; echo $?` → all 0. If `floor.test.ts` moves, read the diff: a drop is recorded with `npm run design:baseline`; a rise is fixed.

- [ ] **Step 5: Look at it**

`preview_start` `alpha-colorlab-offline`, open `/vi/blog/back-button-af` (or any article from `/vi/blog`) and one `/vi/learn/<id>`. At 375: title → dek → "Trong bài viết ▾" closed; tapping it opens the list; no outline above the title. At 1440: rail on the right, sticky, as before. Screenshot both; reset viewport; stop the preview.

- [ ] **Step 6: Commit**

```bash
git add src/components/lab/article-view.tsx src/components/lab/article-view.test.ts
git commit -m "Article page: below lg the outline folds under the dek instead of sitting above the title"
```

---

### Task 3: Copy — one sentence and one action

**Files:**
- Modify: `messages/en.json`, `messages/vi.json`
- Modify: `src/components/browse/recipe-browse.tsx:125-150`
- Modify: `src/components/recipe-community-section.tsx:1004,1017-1019`
- Modify: `src/components/lab/lab-feed.tsx:278-292`
- Modify: any test that pins the old strings or markup (find with `rg -n "emptyTail|emptyBody|stageEmptyBody|tabComments|tabProposals" src`)
- Test: `src/app/copy-cuts.test.ts` (new)

- [ ] **Step 1: Write the failing test**

`src/app/copy-cuts.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Copy cut to one sentence and one action (sub-project 5, 2026-10-28): an
 * empty state is a title and the button that leaves it, an error page one
 * sentence and Try again, and a tab shows no count of nothing.
 */
type Tree = { [k: string]: string | Tree };
const msgs = Object.fromEntries(
  ['en', 'vi'].map((l) => [l, JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')) as Tree]),
) as Record<'en' | 'vi', Tree>;
const at = (l: 'en' | 'vi', path: string) =>
  path.split('.').reduce<string | Tree | undefined>((n, k) => (typeof n === 'object' ? n[k] : undefined), msgs[l]);
const src = (p: string) => readFileSync(p, 'utf8');

describe('the cut copy', () => {
  it('reads as one sentence each', () => {
    expect(at('vi', 'home.emptyTitle')).toBe('Không có công thức nào khớp bộ lọc.');
    expect(at('en', 'home.emptyTitle')).toBe('No recipes match these filters.');
    expect(at('vi', 'home.emptyAction')).toBe('Xoá bộ lọc');
    expect(at('en', 'home.emptyAction')).toBe('Clear filters');
    expect(at('vi', 'error.body')).toBe('Lỗi từ phía chúng tôi, không phải bạn.');
    expect(at('en', 'error.body')).toBe('That’s on us, not you.');
  });

  it('has no explanatory tails left', () => {
    for (const l of ['en', 'vi'] as const) {
      expect(at(l, 'home.emptyTail')).toBeUndefined();
      expect(at(l, 'lab.emptyBody')).toBeUndefined();
      expect(at(l, 'lab.stageEmptyBody')).toBeUndefined();
    }
  });

  it('makes the empty catalogue a button out, not a sentence around a link', () => {
    const browse = src('src/components/browse/recipe-browse.tsx');
    expect(browse).not.toContain("t('emptyTail'");
    expect(browse).toMatch(/<Link href="\/colorlab" className="btn-glass">\s*\{t\('emptyAction'\)\}/);
  });

  it('shows a tab count only when there is something to count', () => {
    const community = src('src/components/recipe-community-section.tsx');
    expect(community).toContain("commentsLoaded && comments.length > 0 ? t('tabComments', { count: comments.length }) : t('tabCommentsPlain')");
    expect(community).toMatch(/proposalsLoaded && proposals\.length > 0\s*\?\s*t\('tabProposals', \{ count: proposals\.length \}\)\s*:\s*t\('tabProposalsPlain'\)/);
  });

  it('gives an empty feed its title and the way out, nothing between', () => {
    const feed = src('src/components/lab/lab-feed.tsx');
    expect(feed).not.toContain("t('emptyBody')");
    expect(feed).not.toContain("t('stageEmptyBody')");
  });
});
```

- [ ] **Step 2: Run, expect RED**

Run: `npx vitest run src/app/copy-cuts.test.ts` → all five FAIL.

- [ ] **Step 3: Messages (both locales)**

`messages/vi.json`: `home.emptyTitle` → `"Không có công thức nào khớp bộ lọc."`; `error.body` → `"Lỗi từ phía chúng tôi, không phải bạn."`; delete `home.emptyTail`, `lab.emptyBody`, `lab.stageEmptyBody`.
`messages/en.json`: `home.emptyTitle` → `"No recipes match these filters."`; `home.emptyAction` → `"Clear filters"`; `error.body` → `"That’s on us, not you."` (typographic apostrophe, as today); delete the same three keys.

- [ ] **Step 4: Components**

`recipe-browse.tsx` — the empty branch becomes (keep the `break-words` comment and the search-elsewhere comment):

```tsx
        <div className="flex flex-col items-center gap-6 py-20 text-center break-words">
          <p className="text-ink-muted">{t('emptyTitle')}</p>
          {/* Clears every filter, which means this page with no query — not
              `/`, which is now the launcher and would drop the reader out of
              the app they are searching in. */}
          <Link href="/colorlab" className="btn-glass">
            {t('emptyAction')}
          </Link>
          {filters.q ? (
            <Link
              href={{ pathname: '/search', query: { q: filters.q } }}
              className="text-accent-400 underline underline-offset-4"
            >
              {tSearch('searchEverything', { query: filters.q })}
            </Link>
          ) : null}
        </div>
```

`recipe-community-section.tsx`:

```tsx
            {commentsLoaded && comments.length > 0 ? t('tabComments', { count: comments.length }) : t('tabCommentsPlain')}
```

```tsx
            {proposalsLoaded && proposals.length > 0
              ? t('tabProposals', { count: proposals.length })
              : t('tabProposalsPlain')}
```

`lab-feed.tsx` — delete the `<p className="mt-3 text-body text-ink-muted">…</p>` holding `stageEmptyBody` / `emptyBody`; the `<h2>` and the `btn-glass` link remain.

- [ ] **Step 5: Run, expect GREEN; fix pinned tests; full suite**

Run: `npx vitest run src/app/copy-cuts.test.ts` → PASS. Run `npm test`; any older test that pinned the removed keys or the old empty-state markup is updated to the new truth (say which, and why, in the report) — never weakened to pass. `messages.test.ts` must pass both ways (parity; a client namespace shipping a deleted key). Then `npm run typecheck`, `npm run lint; echo $?` → 0.

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/vi.json src/components/browse/recipe-browse.tsx src/components/recipe-community-section.tsx src/components/lab/lab-feed.tsx src/app/copy-cuts.test.ts
git add -u src
git commit -m "Copy: empty states are a title and a button, the error page one sentence, no count of nothing"
```

---

### Task 4: Gates on the new layout

**Files:**
- Modify (only if a count dropped): `e2e/budgets.json`, `e2e/first-screen.spec.ts`, `e2e/perf.spec.ts`

- [ ] **Step 1: Run the gates**

Run: `npm run test:screens` (foreground, timeout 600000). If port 3100 is taken by a process you did not start, report it and use `SCREENS_PORT=3101`.
Expected: green, or a failure that is an exact-match count that DROPPED (e.g. phone targets or axe nodes on `/blog/:article` now that the outline links are folded). Paste every printed table and failure verbatim.

- [ ] **Step 2: Record drops, never rises**

For each dropped count, write the new number with a `2026-10-28` note in the file's dated comment (budgets.json `"//"`, or the comment above the constant) naming the cause (outline folded under the dek / settings moved up). A RISE is a defect in Tasks 1–3: stop, report BLOCKED with the evidence. The recipe detail first screen must stay 9 controls; its height (`detail height`) may drop — if the cap can come down a tenth, lower it.

- [ ] **Step 3: Green run, checks, commit**

Run `npm run test:screens` again → EXIT 0; `npm test`, `npm run typecheck`, `npm run lint; echo $?` → 0; `git status --short` clean except your budget edits.

```bash
git add e2e/
git commit -m "Gates: counts re-measured after the reading-page changes"
```

(Skip the commit if nothing changed, and say so.)
