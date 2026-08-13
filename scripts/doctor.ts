/**
 * `npm run doctor` — reads every data file this app ships and says what is
 * wrong with it, in one pass, in one report.
 *
 * This is an operator tool, not a second test suite. `npm run verify` is still
 * the gate. The doctor exists for the three things the gate cannot give you:
 *
 *  - **Cross-file references.** A row in `translations.seed.json` or
 *    `images.seed.json` naming a recipe that no longer exists is invisible to
 *    every per-file test, and invisible at runtime too — the join just returns
 *    nothing and the page renders a recipe with no photo and no prose.
 *  - **A survey rather than a stop.** Vitest reports the first failure per
 *    assertion; when a scrape lands 94 products at once you want the whole list
 *    of what it got wrong, ranked, in one screen.
 *  - **The network.** `--images` re-runs what `fast_image_audit.py` used to do
 *    (0/93 broken, once) against whatever the catalogue holds today. A test
 *    suite must not depend on B&H being up; a person auditing the catalogue
 *    very much wants to know that it isn't.
 *
 * Nothing here restates a camera value. Recipes are checked by `recipeSchema`,
 * spec rows by `SPEC_ROWS`, feature shapes by `splitFeatures` — the same
 * modules the app reads. Rule 1 and Rule 5: widen a range in `constants.ts` and
 * this follows without an edit.
 *
 * Usage:
 *   npm run doctor              # offline checks, ~instant
 *   npm run doctor -- --images  # also HEAD every product photo (slow, network)
 *   npm run doctor -- --strict  # warnings fail the run too
 *   npm run doctor -- --all     # print every offender, not the first 8
 *   npm run doctor -- --json    # machine-readable, for CI to diff over time
 *
 * Exits 1 if anything FAILed (or, with --strict, WARNed).
 */

import { existsSync, readFileSync } from 'node:fs';
import { recipeSchema } from '../src/lib/camera/schema';
import { SPEC_ROWS, type ProductSpecs, type SonyCamera } from '../src/lib/cameras/types';
import { splitFeatures } from '../src/lib/cameras/features';

// ---------------------------------------------------------------------------
// Report model
// ---------------------------------------------------------------------------

type Level = 'ok' | 'warn' | 'fail';

interface Finding {
  level: Level;
  text: string;
  /** Offending rows, named so the fix is findable without a second query. */
  detail?: string[];
}

interface Section {
  title: string;
  /** What was read — row counts, so an empty file reads as empty, not as clean. */
  subtitle: string;
  findings: Finding[];
}

const args = new Set(process.argv.slice(2));
const OPT = {
  images: args.has('--images'),
  strict: args.has('--strict'),
  json: args.has('--json'),
  all: args.has('--all'),
};

/** How many offenders to name before summarising. `--all` lifts it. */
const DETAIL_LIMIT = OPT.all ? Number.POSITIVE_INFINITY : 8;

/**
 * A finding, or nothing at all when the list is empty.
 *
 * Clean checks are deliberately silent rather than a wall of green: the report
 * is read to find problems, and an OK line per check buries them. Each section
 * prints its own OK summary instead.
 */
function issue(level: 'warn' | 'fail', items: string[], label: string): Finding | null {
  if (items.length === 0) return null;
  const shown = items.slice(0, DETAIL_LIMIT);
  const detail =
    items.length > shown.length
      ? [...shown, `…and ${items.length - shown.length} more`]
      : shown;
  return { level, text: `${items.length} ${label}`, detail };
}

function compact(findings: (Finding | null)[]): Finding[] {
  return findings.filter((f): f is Finding => f !== null);
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * A file that will not parse is fatal, not a finding.
 *
 * Every later check would report a hundred derived failures from one broken
 * brace, and the real cause would scroll off the top.
 */
function readJson<T>(path: string): T {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    console.error(`✗ ${path} is missing — cannot run.`);
    process.exit(2);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`✗ ${path} is not valid JSON: ${(e as Error).message}`);
    process.exit(2);
  }
}

interface SeedRecipe {
  id: string;
  slug: string;
  format: string;
  [k: string]: unknown;
}
interface Translation {
  recipeId: string;
  locale: string;
  description: string;
}
interface ImageRow {
  recipeId: string;
  storagePath: string;
  sort: number;
}

const recipes = readJson<SeedRecipe[]>('data/recipes.seed.json');
const translations = readJson<Translation[]>('data/translations.seed.json');
const images = readJson<ImageRow[]>('data/images.seed.json');
const products = readJson<SonyCamera[]>('data/sony-cameras.seed.json');
const en = readJson<Record<string, unknown>>('messages/en.json');
const vi = readJson<Record<string, unknown>>('messages/vi.json');

const recipeIds = new Set(recipes.map((r) => r.id));

/** Values repeated across a list, e.g. two recipes claiming one slug. */
function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  return [...dupes];
}

// ---------------------------------------------------------------------------
// recipes.seed.json
// ---------------------------------------------------------------------------

function checkRecipes(): Section {
  const invalid: string[] = [];
  for (const [i, row] of recipes.entries()) {
    const parsed = recipeSchema.safeParse(row);
    if (parsed.success) continue;
    /* Name the row by id where it has one — an index is useless in a generated
       file nobody reads top to bottom. The first two issues are enough to act
       on; a row failing its discriminator fails every field after it. */
    const who = typeof row?.id === 'string' ? row.id : `row ${i}`;
    const why = parsed.error.issues
      .slice(0, 2)
      .map((p) => `${p.path.join('.') || '(root)'}: ${p.message}`)
      .join('; ');
    invalid.push(`${who} — ${why}`);
  }

  const findings = compact([
    issue('fail', invalid, 'do not parse against recipeSchema'),
    issue('fail', duplicates(recipes.map((r) => r.id)), 'duplicate id'),
    /* Slugs are the public URL. Two recipes sharing one means whichever loses
       the lookup is unreachable, with no error anywhere. */
    issue('fail', duplicates(recipes.map((r) => r.slug)), 'duplicate slug'),
  ]);

  if (invalid.length === 0) {
    findings.unshift({ level: 'ok', text: `${recipes.length} parse against recipeSchema` });
  }

  const pp = recipes.filter((r) => r.format === 'pp').length;
  return {
    title: 'data/recipes.seed.json',
    subtitle: `${recipes.length} rows · ${pp} pp / ${recipes.length - pp} cl`,
    findings,
  };
}

// ---------------------------------------------------------------------------
// translations.seed.json
// ---------------------------------------------------------------------------

function checkTranslations(): Section {
  const orphans = [
    ...new Set(translations.filter((t) => !recipeIds.has(t.recipeId)).map((t) => t.recipeId)),
  ];
  const blank = translations
    .filter((t) => !t.description?.trim())
    .map((t) => `${t.recipeId} (${t.locale})`);

  const byLocale = (locale: string) =>
    new Set(translations.filter((t) => t.locale === locale && t.description?.trim()).map((t) => t.recipeId));
  const withEn = byLocale('en');
  const withVi = byLocale('vi');

  const missingEn = recipes.filter((r) => !withEn.has(r.id)).map((r) => r.id);
  const missingVi = recipes.filter((r) => !withVi.has(r.id)).map((r) => r.id);

  const findings = compact([
    /* An orphan is the cross-file failure no per-file test can see: the row is
       well-formed, the recipe it describes is gone, and the join is silent. */
    issue('fail', orphans, 'reference a recipe that does not exist'),
    issue('fail', blank, 'have a blank description'),
    issue('fail', missingEn, 'recipes have no EN description'),
    /* VI is a documented fallback to English, not a defect — seed:emit says so
       on every run. It is worth counting, not worth failing. */
    issue('warn', missingVi, 'recipes have no VI description (falls back to EN)'),
  ]);

  if (findings.length === 0) {
    findings.push({ level: 'ok', text: `${recipes.length} recipes described in both locales` });
  }

  return {
    title: 'data/translations.seed.json',
    subtitle: `${translations.length} rows · ${withEn.size} en / ${withVi.size} vi`,
    findings,
  };
}

// ---------------------------------------------------------------------------
// images.seed.json
// ---------------------------------------------------------------------------

function checkImages(): Section {
  const orphans = [
    ...new Set(images.filter((r) => !recipeIds.has(r.recipeId)).map((r) => r.recipeId)),
  ];
  const dupeSort = duplicates(images.map((r) => `${r.recipeId}#${r.sort}`));
  const blankPath = images.filter((r) => !r.storagePath?.trim()).map((r) => r.recipeId);

  const covered = new Set(images.map((r) => r.recipeId));
  const noImage = recipes.filter((r) => !covered.has(r.id)).map((r) => r.id);

  const findings = compact([
    issue('fail', orphans, 'reference a recipe that does not exist'),
    /* `sort` is the gallery order. A repeated (recipe, sort) pair orders
       non-deterministically, so the hero photo changes between deploys. */
    issue('fail', dupeSort, 'duplicate (recipeId, sort) pair'),
    issue('fail', blankPath, 'have a blank storagePath'),
    issue('warn', noImage, 'recipes have no photo'),
  ]);

  if (findings.length === 0) {
    findings.push({ level: 'ok', text: `${covered.size} recipes have at least one photo` });
  }

  return {
    title: 'data/images.seed.json',
    subtitle: `${images.length} rows · ${covered.size} recipes covered`,
    findings,
  };
}

// ---------------------------------------------------------------------------
// sony-cameras.seed.json
// ---------------------------------------------------------------------------

const SPEC_BOOKKEEPING = ['kind', 'specsSource', 'specsMissing', 'keySpecs'];

/**
 * Why a product image reference is unusable, or null when it is fine.
 *
 * Two shapes are legitimate. Most products point at B&H's CDN; the handful of
 * vertical lens shots that had to be rotated 90° CCW were re-hosted under
 * `public/products/`, and those are root-relative. A local ref is checked
 * against the filesystem, because deleting the file leaves the seed pointing
 * at a 404 that only shows up as a missing photo in production.
 */
function imageRefProblem(url: string | undefined): string | null {
  if (!url?.trim()) return 'empty';
  if (/^https:\/\//.test(url)) return null;
  if (!url.startsWith('/')) return 'is neither an https URL nor a root-relative path';
  return existsSync(`public${url}`) ? null : 'is not in public/';
}

/** Fields that carry a value, excluding the bookkeeping ones. */
function valueFields(specs: ProductSpecs): [string, unknown][] {
  return Object.entries(specs).filter(([k]) => !SPEC_BOOKKEEPING.includes(k));
}

function checkProducts(): Section {
  const CATEGORIES = ['camera', 'lens', 'accessory'];

  const badCategory: string[] = [];
  const noSpecs: string[] = [];
  const kindMismatch: string[] = [];
  const noSource: string[] = [];
  const undeclaredNull: string[] = [];
  const falseMissing: string[] = [];
  const badValue: string[] = [];
  const sourceProse: string[] = [];
  const noFeaturesEn: string[] = [];
  const noFeaturesVi: string[] = [];
  const badImageUrl: string[] = [];

  for (const p of products) {
    const who = p.name ?? p.id;

    if (!CATEGORIES.includes(p.category)) badCategory.push(`${who} — "${p.category}"`);
    for (const url of [p.imageUrl, ...(p.galleryUrls ?? [])]) {
      const problem = imageRefProblem(url);
      if (problem) badImageUrl.push(`${who} — "${url ?? ''}" ${problem}`);
    }

    const { en: fEn, vi: fVi } = splitFeatures(p.features);
    if (fEn.length === 0) noFeaturesEn.push(who);
    /* The flat-array shape IS English by definition, so an empty vi here is the
       documented pre-admin-UI state, not corruption. `needsTranslation()` flags
       exactly this in the admin list; the doctor just counts the backlog. */
    else if (fVi.length === 0) noFeaturesVi.push(who);

    if (!p.specs) {
      noSpecs.push(who);
      continue;
    }
    const specs = p.specs;

    /* A lens rendered through the camera template shows thirteen "not
       published" rows, which reads as a sparse source rather than a bug. */
    if (specs.kind !== p.category) kindMismatch.push(`${who} — ${specs.kind} on a ${p.category}`);
    if (!/^https:\/\//.test(specs.specsSource ?? '')) noSource.push(who);

    const fields = valueFields(specs);
    const nulls = fields.filter(([, v]) => v === null).map(([k]) => k);
    const declared = new Set(specs.specsMissing ?? []);

    /* The load-bearing pair. A null with no entry in specsMissing is
       indistinguishable from a field the extractor forgot, and that ambiguity
       is what lets a later pass "helpfully" fill it in from memory. */
    for (const k of nulls) if (!declared.has(k)) undeclaredNull.push(`${who}.${k}`);
    for (const k of declared) {
      const v = (specs as unknown as Record<string, unknown>)[k];
      if (v !== null && v !== undefined) falseMissing.push(`${who}.${k}`);
    }

    for (const [k, v] of fields) {
      if (v === null) continue;
      if (typeof v !== 'string') {
        badValue.push(`${who}.${k} — ${typeof v}, expected string`);
        continue;
      }
      if (v.trim() === '') badValue.push(`${who}.${k} — blank`);
      /* Same wordlist specs.test.ts pins. "Xấp xỉ 679 g" is a user-visible
         Vietnamese string living outside messages/, which Rule 3 forbids. */
      else if (/Xấp xỉ|Khoảng |tương đương|loại /i.test(v)) sourceProse.push(`${who}.${k}`);
    }
  }

  // Every row either template renders needs a label, and these sit nested under
  // `cameras.specs`, where the EN/VI parity check cannot see whether one exists.
  const specLabels = ((en.cameras as Record<string, unknown> | undefined)?.specs ?? {}) as Record<
    string,
    unknown
  >;
  const unlabelled = [
    ...new Set(
      Object.entries(SPEC_ROWS).flatMap(([kind, rows]) =>
        rows.filter((f) => !(f in specLabels)).map((f) => `${kind}.${f}`),
      ),
    ),
  ];

  const findings = compact([
    issue('fail', badCategory, 'have a category the UI cannot render'),
    issue('fail', kindMismatch, 'tag specs with the wrong kind'),
    issue('fail', undeclaredNull, 'null specs are not declared in specsMissing'),
    issue('fail', falseMissing, 'specsMissing entries actually hold a value'),
    issue('fail', badValue, 'spec values are not usable strings'),
    issue('fail', noSource, 'products cite no specsSource'),
    issue('fail', unlabelled, 'SPEC_ROWS fields have no label in messages/en.json'),
    issue('fail', badImageUrl, 'product image references are unusable'),
    issue('fail', noFeaturesEn, 'products have no English feature bullets'),
    issue('warn', sourceProse, 'spec values carry Vietnamese source prose'),
    issue('warn', noSpecs, 'products have no specs block yet'),
    issue('warn', noFeaturesVi, 'products await a Vietnamese feature pass'),
    issue('fail', duplicates(products.map((p) => p.id)), 'duplicate product id'),
    issue('fail', duplicates(products.map((p) => p.sku)), 'duplicate sku'),
  ]);

  const withSpecs = products.filter((p) => p.specs).length;
  if (!findings.some((f) => f.level === 'fail')) {
    findings.unshift({ level: 'ok', text: `${withSpecs} spec blocks are fully sourced` });
  }

  const byCat = CATEGORIES.map(
    (c) => `${products.filter((p) => p.category === c).length} ${c}`,
  ).join(' / ');
  return {
    title: 'data/sony-cameras.seed.json',
    subtitle: `${products.length} products · ${byCat} · ${withSpecs} with specs`,
    findings,
  };
}

// ---------------------------------------------------------------------------
// messages/
// ---------------------------------------------------------------------------

/** Flattens to dotted paths so a nested key missing on one side is visible. */
function paths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    paths(v, prefix ? `${prefix}.${k}` : k),
  );
}

function checkMessages(): Section {
  const enPaths = paths(en);
  const viPaths = paths(vi);
  const enSet = new Set(enPaths);
  const viSet = new Set(viPaths);

  /* The failure is one-directional and silent: a key present only in vi.json
     renders untranslated to English readers and nothing errors. */
  const findings = compact([
    issue('fail', enPaths.filter((p) => !viSet.has(p)), 'keys are in en.json but not vi.json'),
    issue('fail', viPaths.filter((p) => !enSet.has(p)), 'keys are in vi.json but not en.json'),
  ]);

  if (findings.length === 0) {
    findings.push({ level: 'ok', text: `${enPaths.length} keys, both locales in parity` });
  }

  return {
    title: 'messages/',
    subtitle: `en ${enPaths.length} / vi ${viPaths.length} keys`,
    findings,
  };
}

// ---------------------------------------------------------------------------
// Product photography (network, opt-in)
// ---------------------------------------------------------------------------

/** Runs `work` over `items` with a fixed number of workers in flight. */
async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await work(item);
    }
  });
  await Promise.all(workers);
}

async function checkImageUrls(): Promise<Section> {
  // One product can carry the same shot twice across gallery and hero; the CDN
  // does not need to hear about it twice. Root-relative refs are already
  // verified against public/ by the offline pass — there is nothing to fetch.
  const targets = new Map<string, string>();
  let local = 0;
  for (const p of products) {
    for (const url of [p.imageUrl, ...(p.galleryUrls ?? [])]) {
      if (!url) continue;
      if (!/^https:\/\//.test(url)) {
        local++;
        continue;
      }
      if (!targets.has(url)) targets.set(url, p.name ?? p.id);
    }
  }

  const broken: string[] = [];
  await pool([...targets], 8, async ([url, who]) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        let res = await fetch(url, { method: 'HEAD', signal: controller.signal });
        // Some CDNs refuse HEAD outright; that is not a broken image.
        if (res.status === 405 || res.status === 501) {
          res = await fetch(url, { method: 'GET', signal: controller.signal });
        }
        if (!res.ok) broken.push(`${who} — ${res.status} ${url}`);
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      /* A timeout or DNS failure is not proof the image is gone, so it is
         reported as its own thing rather than counted as a 404. */
      broken.push(`${who} — ${(e as Error).name}: ${url}`);
    }
  });

  const findings = compact([issue('fail', broken, 'product photos do not resolve')]);
  if (findings.length === 0) {
    findings.push({ level: 'ok', text: `${targets.size} product photos resolve` });
  }

  return {
    title: 'product photography (network)',
    subtitle: `${targets.size} unique URLs · ${local} served from public/`,
    findings,
  };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, s: string) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const BADGE: Record<Level, string> = {
  ok: paint('32', 'OK  '),
  warn: paint('33', 'WARN'),
  fail: paint('31', 'FAIL'),
};

function render(sections: Section[]) {
  console.log('');
  for (const s of sections) {
    console.log(`  ${paint('1', s.title)}  ${paint('2', s.subtitle)}`);
    for (const f of s.findings) {
      console.log(`    ${BADGE[f.level]}  ${f.text}`);
      for (const d of f.detail ?? []) console.log(paint('2', `            ${d}`));
    }
    console.log('');
  }

  const all = sections.flatMap((s) => s.findings);
  const fails = all.filter((f) => f.level === 'fail').length;
  const warns = all.filter((f) => f.level === 'warn').length;

  if (fails === 0 && warns === 0) console.log(`  ${paint('32', 'clean')} — no findings\n`);
  else console.log(`  ${fails} fail · ${warns} warn\n`);

  if (!OPT.images) {
    console.log(paint('2', '  product photos not checked — re-run with --images\n'));
  }
}

async function main() {
  const sections = [
    checkRecipes(),
    checkTranslations(),
    checkImages(),
    checkProducts(),
    checkMessages(),
  ];
  if (OPT.images) sections.push(await checkImageUrls());

  const all = sections.flatMap((s) => s.findings);
  const failed =
    all.some((f) => f.level === 'fail') || (OPT.strict && all.some((f) => f.level === 'warn'));

  if (OPT.json) console.log(JSON.stringify({ ok: !failed, sections }, null, 2));
  else render(sections);

  process.exit(failed ? 1 : 0);
}

// Not top-level await: this package is CommonJS, and esbuild refuses it there.
main().catch((e: unknown) => {
  console.error(`✗ doctor crashed: ${(e as Error).stack ?? e}`);
  process.exit(2);
});
