# Blog-content skill and content packs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A skill that turns an owner's document into Vietnamese `/blog` and `/learn` pages as a tested content pack in the repo, plus `push:lab --pack` so the owner inserts them as drafts with one command.

**Architecture:** Packs are typed `Article[]` files under `src/lib/lab/packs/`, gated by a pure `packProblems()` that reuses `validateForPublish` and checks ids, references and sources against the seeds; `push:lab` takes its candidate list from a pure `labCandidates()`; three small research scripts (`scripts/research/`) verify links, videos and Sony sources, with their parsing in a tested `lib.ts`; `SKILL.md` is the procedure.

**Tech Stack:** TypeScript, vitest, tsx scripts, Next 16 repo conventions (no UI change).

Spec: `docs/superpowers/specs/2026-10-28-blog-content-skill-design.md`.

## Global Constraints

- Branch `claude/blog-content-skill`, repo `/home/thaikpham/Desktop/ColorLab 2.0`. Commit on top of HEAD; no rebase/amend/worktree. Do not push.
- Never run `push:*` (including `push:lab`), `content:import`, `supabase:migrations --apply`; never use `.env.local` credentials; never `rm -rf .next`; never `next dev` through Bash.
- No UI change, no new block type, no change to `validateForPublish` or the parser.
- Article bodies are Vietnamese (ADR 0004); camera menu terms stay as printed on the camera.
- `npm test`, `npm run typecheck`, `npm run lint; echo $?` (never piped) before each commit.
- Do not edit `CLAUDE.md` or `AGENTS.md`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Packs and their gate

**Files:**
- Create: `src/lib/lab/packs/index.ts`
- Create: `src/lib/lab/packs/check.ts`
- Create: `src/lib/lab/packs/packs.test.ts`

**Interfaces:**
- Produces: `PACKS: Readonly<Record<string, readonly Article[]>>` (from `@/lib/lab/packs`); `PACK_NAME_RE = /^[a-z0-9-]+$/`; `type Known = { takenIds: ReadonlySet<string>; refIds: Readonly<Record<ContentRefKind, ReadonlySet<string>>> }`; `packProblems(name: string, pages: readonly Article[], known: Known): string[]`.

- [ ] **Step 1: Write the failing tests**

`src/lib/lab/packs/packs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import recipesSeed from '../../../../data/recipes.seed.json'
import camerasSeed from '../../../../data/sony-cameras.seed.json'
import audioSeed from '../../../../data/sony-audio.seed.json'
import { ARTICLES } from '../articles'
import { PILOT_DRAFTS } from '../pilot-drafts'
import { RESERVED_IDS } from '../parse'
import type { Article, Block } from '../types'
import { packProblems, type Known } from './check'
import { PACKS } from './index'

/**
 * A pack is pages the blog-content skill wrote from an owner's document,
 * waiting to be pushed as drafts (`push:lab --pack <name>`). The gate is
 * stricter than a draft needs on purpose: a pack page must already pass the
 * publish rules, link only to things that exist, and cite a dated source, so
 * the owner's review is about the writing, not about broken plumbing.
 */
const ids = (rows: readonly { id: string }[]) => new Set(rows.map((r) => r.id))
const pages = (except?: string) => [
  ...ARTICLES,
  ...PILOT_DRAFTS,
  ...Object.entries(PACKS).flatMap(([n, p]) => (n === except ? [] : p)),
]

function knownFor(pack: string, extra: readonly Article[] = []): Known {
  const all = [...pages(), ...extra]
  return {
    takenIds: new Set([...ids(pages(pack)), ...RESERVED_IDS]),
    refIds: {
      recipe: ids(recipesSeed as { id: string }[]),
      product: new Set([...ids(camerasSeed as { id: string }[]), ...ids(audioSeed as { id: string }[])]),
      article: ids(all.filter((a) => a.kind === 'article')),
      knowledge: ids(all.filter((a) => a.kind === 'knowledge')),
    },
  }
}

describe('every pack', () => {
  for (const [name, pack] of Object.entries(PACKS)) {
    it(`${name} is ready to push`, () => {
      expect(packProblems(name, pack, knownFor(name))).toEqual([])
    })
  }
})

/* The probes: one good page, and one way to break each rule. The base is a
   live article (it passes the publish rules today) under a fresh id, with a
   dated source added. */
const source = { url: 'https://helpguide.sony.net/', title: 'Help Guide', publisher: 'Sony', checkedAt: '2026-10-28' }
const good: Article = { ...ARTICLES[0], id: 'probe-page', meta: { ...ARTICLES[0].meta, sources: [source] } }
const check = (p: readonly Article[]) => packProblems('probe', p, knownFor('probe', p))

describe('packProblems', () => {
  it('passes a page that meets every rule', () => {
    expect(check([good])).toEqual([])
  })

  it('refuses a pack name that is not a slug', () => {
    expect(packProblems('Bad Name', [good], knownFor('Bad Name', [good]))).toContain('packName')
  })

  it('carries the publish rules, prefixed with the page id', () => {
    expect(check([{ ...good, dek: '' }])).toContain('probe-page: emptyDek')
  })

  it('refuses a duplicate id within the pack and an id already taken', () => {
    expect(check([good, good])).toContain('probe-page: duplicateId')
    expect(check([{ ...good, id: ARTICLES[1].id }])).toContain(`${ARTICLES[1].id}: idTaken`)
  })

  it('refuses a reference to something that does not exist', () => {
    const bad = { ...good, meta: { ...good.meta, related: [{ kind: 'recipe' as const, id: 'PP-999' }] } }
    expect(check([bad])).toContain('probe-page: unknownRef recipe:PP-999')
    const pre = { ...good, meta: { ...good.meta, prerequisites: ['khong-co-trang-nay'] } }
    expect(check([pre])).toContain('probe-page: unknownPrerequisite khong-co-trang-nay')
  })

  it('lets a page name another page of the same pack', () => {
    const pillar: Article = { ...good, id: 'probe-pillar' }
    const cluster: Article = { ...good, meta: { ...good.meta, prerequisites: ['probe-pillar'] } }
    expect(check([pillar, cluster])).toEqual([])
  })

  it('wants at least one source, each dated', () => {
    expect(check([{ ...good, meta: { ...good.meta, sources: [] } }])).toContain('probe-page: noSource')
    const undated = { ...good, meta: { ...good.meta, sources: [{ ...source, checkedAt: undefined }] } }
    expect(check([undated])).toContain('probe-page: sourceNeedsDate')
  })

  it('refuses a figure: a picture is an upload, added from the page editor', () => {
    const figure = { t: 'figure', caption: 'x', asset: '00000000-0000-0000-0000-000000000000' } as unknown as Block
    const blocks = [...good.blocks.slice(0, -1), figure, good.blocks[good.blocks.length - 1]]
    expect(check([{ ...good, blocks }])).toContain('probe-page: figureNeedsUpload')
  })
})
```

Check the real shape of `FigureBlock` in `src/lib/lab/types.ts` (the asset field's name) and use it in the `figure` probe instead of `asset` if it differs; the cast stays.

- [ ] **Step 2: Run, expect RED**

Run: `npx vitest run src/lib/lab/packs/packs.test.ts`
Expected: FAIL — cannot resolve `./check` / `./index`.

- [ ] **Step 3: Implement**

`src/lib/lab/packs/index.ts`:

```ts
import type { Article } from '../types'

/**
 * Content packs: pages the blog-content skill (`.claude/skills/colorlab-blog-content`)
 * wrote from one of the owner's documents. One file per pack, `<name>.ts`,
 * exporting its `Article[]`, listed here. `push:lab --pack <name>` inserts a
 * pack's pages as drafts and never overwrites a row; `packs.test.ts` is the
 * gate every pack passes before it can be merged.
 */
export const PACKS: Readonly<Record<string, readonly Article[]>> = {}
```

`src/lib/lab/packs/check.ts`:

```ts
import { validateForPublish } from '../parse'
import type { Article, ContentRefKind } from '../types'

export const PACK_NAME_RE = /^[a-z0-9-]+$/

/** What a pack may link to and which ids it may not take. Built by the caller
    from the seeds and the other page lists, so this stays pure. */
export type Known = {
  readonly takenIds: ReadonlySet<string>
  readonly refIds: Readonly<Record<ContentRefKind, ReadonlySet<string>>>
}

/** Every reason this pack cannot be pushed, `<page id>: <code>`; empty when it can. */
export function packProblems(name: string, pages: readonly Article[], known: Known): string[] {
  const problems: string[] = []
  if (!PACK_NAME_RE.test(name)) problems.push('packName')
  const seen = new Set<string>()
  for (const page of pages) {
    const at = (code: string) => problems.push(`${page.id}: ${code}`)
    for (const p of validateForPublish(page)) at(p)
    if (seen.has(page.id)) at('duplicateId')
    seen.add(page.id)
    if (known.takenIds.has(page.id)) at('idTaken')
    for (const ref of page.meta.related) {
      if (!known.refIds[ref.kind]?.has(ref.id)) at(`unknownRef ${ref.kind}:${ref.id}`)
    }
    for (const id of page.meta.prerequisites) {
      if (!known.refIds.article.has(id) && !known.refIds.knowledge.has(id)) at(`unknownPrerequisite ${id}`)
    }
    if (page.meta.sources.length === 0) at('noSource')
    if (page.meta.sources.some((s) => !s.checkedAt)) at('sourceNeedsDate')
    if (page.blocks.some((b) => b.t === 'figure')) at('figureNeedsUpload')
  }
  return problems
}
```

- [ ] **Step 4: Run, expect GREEN; full suite**

Run: `npx vitest run src/lib/lab/packs/packs.test.ts` → PASS (the `every pack` block has no cases while `PACKS` is empty; the probes carry the gate). If `validateForPublish` reports something for `good` (e.g. a knowledge-only rule), print it and adjust the probe base, never the checker. Then `npm test`, `npm run typecheck`, `npm run lint; echo $?` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lab/packs
git commit -m "Content packs: a typed list and the gate every pack passes before it is pushed"
```

---

### Task 2: `push:lab --pack <name>`

**Files:**
- Create: `scripts/lib/lab-candidates.ts`
- Create: `scripts/lab-candidates.test.ts`
- Modify: `scripts/supabase/args.ts` (`pack` value flag)
- Modify: the existing args test (find it with `rg -ln "parseArgs|requireTarget" scripts src --glob '*.test.ts'`) — add the `--pack` cases there
- Modify: `scripts/push-lab-articles.ts` (use `labCandidates`, accept `--pack`)

**Interfaces:**
- Consumes: `PACKS`, `PACK_NAME_RE` from Task 1.
- Produces: `type LabCandidate = { article: Article; status: 'published' | 'draft' }`; `labCandidates(opts: { withPilotDrafts: boolean; pack?: string }, packs?: Readonly<Record<string, readonly Article[]>>): LabCandidate[]`; `ParsedArgs.pack?: string`.

- [ ] **Step 1: Write the failing tests**

`scripts/lab-candidates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ARTICLES } from '../src/lib/lab/articles'
import { PILOT_DRAFTS } from '../src/lib/lab/pilot-drafts'
import { labCandidates } from './lib/lab-candidates'

describe('labCandidates', () => {
  it('is exactly what push:lab inserted before packs existed', () => {
    expect(labCandidates({ withPilotDrafts: false })).toEqual(ARTICLES.map((article) => ({ article, status: 'published' })))
    expect(labCandidates({ withPilotDrafts: true })).toEqual([
      ...ARTICLES.map((article) => ({ article, status: 'published' })),
      ...PILOT_DRAFTS.map((article) => ({ article, status: 'draft' })),
    ])
  })

  it('adds a pack as drafts, never as published', () => {
    const page = { ...ARTICLES[0], id: 'probe-page' }
    const got = labCandidates({ withPilotDrafts: false, pack: 'probe' }, { probe: [page] })
    expect(got.at(-1)).toEqual({ article: page, status: 'draft' })
  })

  it('refuses a pack that does not exist, naming the ones that do', () => {
    expect(() => labCandidates({ withPilotDrafts: false, pack: 'nope' }, { one: [], two: [] })).toThrow(
      /Unknown pack "nope"\. Packs: one, two/,
    )
  })
})
```

In the args test file, add:

```ts
  it('reads --pack as a slug, once', () => {
    expect(parseArgs(['--target', 'content', '--pack', 'iso-co-ban']).pack).toBe('iso-co-ban')
    expect(() => parseArgs(['--pack', 'Not A Slug'])).toThrow(ArgumentError)
    expect(() => parseArgs(['--pack'])).toThrow(ArgumentError)
    expect(() => parseArgs(['--pack', 'a', '--pack', 'b'])).toThrow(ArgumentError)
  })
```

(match the file's existing import of `parseArgs` / `ArgumentError` and its `describe`).

- [ ] **Step 2: Run, expect RED**

Run: `npx vitest run scripts/lab-candidates.test.ts` and the args test → FAIL (missing module; `--pack` unknown argument).

- [ ] **Step 3: Implement**

`scripts/lib/lab-candidates.ts`:

```ts
import { ARTICLES } from '../../src/lib/lab/articles'
import { PACKS } from '../../src/lib/lab/packs'
import { PILOT_DRAFTS } from '../../src/lib/lab/pilot-drafts'
import type { Article } from '../../src/lib/lab/types'

export type LabCandidate = { article: Article; status: 'published' | 'draft' }

/**
 * What `push:lab` may insert. The three live articles go in published (a draft
 * would take them off the site); pilot drafts and a pack's pages go in as
 * drafts, always — the owner publishes each from its own editor.
 */
export function labCandidates(
  opts: { withPilotDrafts: boolean; pack?: string },
  packs: Readonly<Record<string, readonly Article[]>> = PACKS,
): LabCandidate[] {
  const out: LabCandidate[] = ARTICLES.map((article) => ({ article, status: 'published' }))
  if (opts.withPilotDrafts) out.push(...PILOT_DRAFTS.map((article) => ({ article, status: 'draft' as const })))
  if (opts.pack !== undefined) {
    const pack = packs[opts.pack]
    if (!pack) {
      throw new Error(`Unknown pack "${opts.pack}". Packs: ${Object.keys(packs).join(', ') || '(none yet)'}`)
    }
    out.push(...pack.map((article) => ({ article, status: 'draft' as const })))
  }
  return out
}
```

`scripts/supabase/args.ts`: add to `ParsedArgs`

```ts
  /**
   * `push:lab --pack <name>` also inserts that content pack
   * (`src/lib/lab/packs/`), as drafts. A slug, given at most once.
   */
  pack?: string;
```

and teach `parseArgs` the flag before the `VALUE_FLAGS` lookup (keep the module's no-guessing rule: a second `--pack` is an error, not last-wins):

```ts
    if (flag === '--pack') {
      const value = argv[i + 1];
      i += 1;
      if (!value || !/^[a-z0-9-]+$/.test(value)) {
        throw new ArgumentError('--pack must be a pack name: lower-case letters, digits and dashes.');
      }
      if (parsed.pack !== undefined) throw new ArgumentError(`--pack is given twice, as ${parsed.pack} and ${value}.`);
      parsed.pack = value;
      continue;
    }
```

If `requireTarget` lists the flags a script accepts (its second argument), make `push-lab-articles.ts` accept `--pack` there. In `push-lab-articles.ts`, replace the `candidates` array with

```ts
  const candidates = labCandidates({ withPilotDrafts: args.withPilotDrafts, pack: args.pack });
```

called BEFORE `adminClient(target)` (an unknown pack fails without touching the network), remove the now-unused `ARTICLES` / `PILOT_DRAFTS` imports, and extend the header comment with one paragraph on `--pack <name>` (drafts, insert-only, `--dry-run` first). Nothing else in the script changes.

- [ ] **Step 4: Run, expect GREEN; full suite**

Run the two test files → PASS; `npm test`, `npm run typecheck`, `npm run lint; echo $?` → 0. Do NOT run `push:lab`.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/lab-candidates.ts scripts/lab-candidates.test.ts scripts/supabase/args.ts scripts/push-lab-articles.ts
git add -u scripts
git commit -m "push:lab --pack: a content pack goes in as drafts, from a tested candidate list"
```

---

### Task 3: Research scripts

**Files:**
- Create: `scripts/research/lib.ts`, `scripts/research/lib.test.ts`
- Create: `scripts/research/check-urls.ts`, `scripts/research/youtube.ts`, `scripts/research/sony-source.ts`

**Interfaces:**
- Produces: `readUrls(text: string): string[]`; `parseOembed(id: string, json: unknown): { id: string; title: string; channel: string; channelUrl: string } | null`; `sourceFromHtml(url: string, html: string, today: string): SourceRef`; `isSonyHost(url: string): boolean`; `todayUtc(now?: Date): string`.

- [ ] **Step 1: Write the failing tests**

`scripts/research/lib.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isSonyHost, parseOembed, readUrls, sourceFromHtml, todayUtc } from './lib'

describe('readUrls', () => {
  it('takes one URL per line or space, skips blanks and comments, keeps order, drops repeats', () => {
    expect(readUrls('https://a.test/x\n\n# note\nhttps://b.test https://a.test/x\n')).toEqual([
      'https://a.test/x',
      'https://b.test',
    ])
  })
})

describe('parseOembed', () => {
  it('keeps title and channel from an oEmbed answer', () => {
    expect(
      parseOembed('abc', { title: 'Alpha Universe', author_name: 'Sony | Alpha Universe', author_url: 'https://www.youtube.com/@AlphaUniverse' }),
    ).toEqual({ id: 'abc', title: 'Alpha Universe', channel: 'Sony | Alpha Universe', channelUrl: 'https://www.youtube.com/@AlphaUniverse' })
  })
  it('is null for anything that is not an oEmbed answer', () => {
    expect(parseOembed('abc', 'Not Found')).toBeNull()
    expect(parseOembed('abc', { error: 'x' })).toBeNull()
  })
})

describe('sourceFromHtml', () => {
  it('titles a Help Guide page by its h1, dated today', () => {
    const html = '<html><head><title>Picture Profile | Help Guide | ILCE-7M4</title></head><body><h1 class="t"> Picture Profile </h1></body></html>'
    expect(sourceFromHtml('https://helpguide.sony.net/ilc/2110/v1/en/contents/0405.html', html, '2026-10-28')).toEqual({
      url: 'https://helpguide.sony.net/ilc/2110/v1/en/contents/0405.html',
      title: 'Picture Profile',
      publisher: 'Sony',
      checkedAt: '2026-10-28',
    })
  })
  it('falls back to the <title> without its site suffix, and decodes entities', () => {
    const html = '<title>AF w/ Shutter &amp; AF-ON | Help Guide</title>'
    expect(sourceFromHtml('https://helpguide.sony.net/x', html, '2026-10-28').title).toBe('AF w/ Shutter & AF-ON')
  })
})

describe('isSonyHost', () => {
  it('accepts Sony hosts only', () => {
    expect(isSonyHost('https://helpguide.sony.net/ilc/x')).toBe(true)
    expect(isSonyHost('https://www.sony.com/electronics')).toBe(true)
    expect(isSonyHost('https://alphauniverse.com/x')).toBe(false)
    expect(isSonyHost('https://sony.net.evil.test/')).toBe(false)
  })
})

describe('todayUtc', () => {
  it('is the UTC calendar day', () => {
    expect(todayUtc(new Date('2026-10-28T23:30:00-05:00'))).toBe('2026-10-29')
  })
})
```

- [ ] **Step 2: Run, expect RED**

Run: `npx vitest run scripts/research/lib.test.ts` → FAIL (missing module).

- [ ] **Step 3: Implement `lib.ts`**

```ts
import type { SourceRef } from '../../src/lib/lab/types'

/** URLs from free text: whitespace-separated, `#` lines skipped, first occurrence kept. */
export function readUrls(text: string): string[] {
  const out: string[] = []
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('#')) continue
    for (const word of line.split(/\s+/)) if (/^https?:\/\//.test(word) && !out.includes(word)) out.push(word)
  }
  return out
}

/** A YouTube oEmbed answer, or null when the video cannot be embedded. */
export function parseOembed(id: string, json: unknown) {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  if (typeof o.title !== 'string' || typeof o.author_name !== 'string') return null
  return { id, title: o.title, channel: o.author_name, channelUrl: typeof o.author_url === 'string' ? o.author_url : '' }
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
const text = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

/** A dated source from a Sony page: its h1, else its <title> before the first " | ". */
export function sourceFromHtml(url: string, html: string, today: string): SourceRef {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
  const title = h1 && text(h1) ? text(h1) : text((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').split(' | ')[0])
  return { url, title, publisher: 'Sony', checkedAt: today }
}

const SONY_DOMAINS = ['sony.net', 'sony.com', 'sony.co.uk', 'sony.com.vn', 'sony.jp', 'sony.co.jp']

/** Sony's own domains and their subdomains — the publisher a SourceRef names. */
export function isSonyHost(url: string): boolean {
  const host = new URL(url).hostname
  return SONY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
}

/** `YYYY-MM-DD` in UTC — what `checkedAt` stores. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Run, expect GREEN**

Run: `npx vitest run scripts/research/lib.test.ts` → PASS.

- [ ] **Step 5: The three CLIs (thin, no logic beyond I/O)**

`scripts/research/check-urls.ts`:

```ts
/**
 * Every link a page cites must answer 200. Usage:
 *   npx tsx scripts/research/check-urls.ts https://a … | or one per line on stdin
 * Exit 1 if any does not.
 */
import { readUrls } from './lib'

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

async function main() {
  const input = process.argv.length > 2 ? process.argv.slice(2).join('\n') : await new Response(process.stdin as unknown as ReadableStream).text()
  let bad = 0
  for (const url of readUrls(input)) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA } })
      const moved = res.url !== url ? ` → ${res.url}` : ''
      if (res.status !== 200) bad += 1
      console.log(`${res.status} ${url}${moved}`)
    } catch (e) {
      bad += 1
      console.log(`ERR ${url} ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  process.exit(bad ? 1 : 0)
}
void main()
```

`scripts/research/youtube.ts`:

```ts
/**
 * Can these YouTube videos be embedded, and whose channel are they on? Usage:
 *   npx tsx scripts/research/youtube.ts <id> [id…]
 * Prints one JSON line per id; exit 1 if any cannot be embedded.
 */
import { parseOembed } from './lib'

async function main() {
  let bad = 0
  for (const id of process.argv.slice(2)) {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`
    const res = await fetch(url).catch(() => null)
    const got = res?.ok ? parseOembed(id, await res.json().catch(() => null)) : null
    if (!got) bad += 1
    console.log(JSON.stringify(got ?? { id, embeddable: false }))
  }
  process.exit(bad ? 1 : 0)
}
void main()
```

`scripts/research/sony-source.ts`:

```ts
/**
 * A dated SourceRef for a Sony page, read now. Usage:
 *   npx tsx scripts/research/sony-source.ts <url>
 * Refuses a host that is not Sony's; exit 1 unless the page answers 200.
 */
import { isSonyHost, sourceFromHtml, todayUtc } from './lib'

async function main() {
  const url = process.argv[2]
  if (!url || !isSonyHost(url)) {
    console.error('Give one Sony URL (helpguide.sony.net, sony.com, …).')
    process.exit(1)
  }
  const res = await fetch(url, { redirect: 'follow' })
  if (res.status !== 200) {
    console.error(`${res.status} ${url}`)
    process.exit(1)
  }
  console.log(JSON.stringify(sourceFromHtml(res.url, await res.text(), todayUtc()), null, 2))
}
void main()
```

Then run each once by hand to prove the wiring (read-only, public): `npx tsx scripts/research/check-urls.ts https://helpguide.sony.net/`, `npx tsx scripts/research/youtube.ts <a real Sony Alpha Universe video id you find with WebSearch>`, `npx tsx scripts/research/sony-source.ts <a helpguide.sony.net contents page cited in src/lib/camera/constants.ts>`. Paste the outputs in the report. If the network is unavailable, say so; the unit tests are the gate.

- [ ] **Step 6: Full suite; commit**

`npm test`, `npm run typecheck`, `npm run lint; echo $?` → 0.

```bash
git add scripts/research
git commit -m "Research scripts: links that answer 200, videos that embed, Sony pages as dated sources"
```

---

### Task 4: The skill

**Files:**
- Create: `.claude/skills/colorlab-blog-content/SKILL.md`

- [ ] **Step 1: Write the skill**

Frontmatter `name: colorlab-blog-content`, and a `description` (one paragraph, in English, like the repo's other skills) that says: turn a document the owner sends (notes, an outline, a handoff, a knowledge base) into Vietnamese `/blog` articles and `/learn` knowledge pages, end to end and without questions back — research against Sony's Help Guide, camera values from `constants.ts`, verified links and videos, a content pack in the repo that passes `packs.test.ts`, a PR, and a Vietnamese report with the push command; use whenever the owner shares a document for the blog or `/learn`, or asks for articles on a camera/colour topic.

Body: the spec's §1 steps 1–6, written as instructions (imperative, concise), with:
- **Where pages live:** `lab_articles` is the source of truth once pushed; packs are `src/lib/lab/packs/<name>.ts`, listed in `packs/index.ts`; `push:lab --pack` inserts drafts and never overwrites; never rename a pushed page's id; a correction after the push is made in the page's own Sửa, not in the pack.
- **The block vocabulary** (closed, ten types, from `src/lib/lab/types.ts`) and the shape rules from `validateForPublish` (`parse.ts`) for each kind, stated briefly with a pointer to the code — never restated as numbers that can drift: name `validateArticleShape`, `validateKnowledgeShape`, `houseRules` and say "read them before writing".
- **The research rules** with the three script commands exactly as in Task 3, Rule 1 (camera values from `constants.ts`), and the "never invent" list.
- **The writing rules** from the spec (definition first, facts table, FAQ as `h` level 3 + one `p` each, menu paths starting `MENU` with ` → `, Vietnamese body, terms as printed on the camera, no figure blocks).
- **Checks before the PR:** `npx vitest run src/lib/lab/packs`, `npm test`, `npm run typecheck`, `npm run lint` (check `echo $?`).
- **The report template** (Vietnamese headings): Đã viết · Đã sửa từ tài liệu · Bỏ ra và lý do · Ảnh cần thêm · Lệnh đẩy bài (the two commands).
- **Never:** run `push:lab` yourself; publish anything; edit a page someone has edited after the push; add a block type.

Keep it under ~120 lines.

- [ ] **Step 2: Check it against the code**

Every file, function and command the skill names must exist: `rg -n` each name (`validateArticleShape`, `validateKnowledgeShape`, `houseRules`, `PACKS`, `packProblems`, `labCandidates`, the three scripts). Fix the skill, not the code.

- [ ] **Step 3: Full suite; commit**

`npm test`, `npm run typecheck`, `npm run lint; echo $?` → 0.

```bash
git add .claude/skills/colorlab-blog-content/SKILL.md
git commit -m "Skill: colorlab-blog-content — a document in, a tested content pack and a PR out"
```
