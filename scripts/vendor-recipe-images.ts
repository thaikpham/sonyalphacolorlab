/**
 * Vendors the recipe photographs into `public/`, at the sizes the layouts ask for.
 *
 * This replaces Supabase Storage as the origin for recipe photography, and the
 * reason is measured rather than aesthetic. Storage served every photograph at
 * its stored resolution — the loader passed those URLs through untouched — so a
 * 210px grid card downloaded a full original. Against 24h of Supabase edge logs
 * that was 1.27GB of CDN egress a day, ~38GB a month against a 5GB quota, which
 * restricted the whole project: Storage, Auth and PostgREST all answering `402
 * exceed_cached_egress_quota` together.
 *
 * Serving them from `public/` puts them on the same static CDN as the fonts.
 * No egress quota, no image-optimizer transformations, and — the part that
 * matters beyond this incident — `AGENTS.md` promises the app "builds, runs and
 * tests offline" with no credentials. It did, except that every photograph
 * silently vanished, because `publicImageUrl()` returns null with no Supabase
 * URL configured. Now it doesn't.
 *
 * Both source libraries are still live and were re-fetched to build this, which
 * is what made it possible while the project was restricted: the Google Photos
 * originals behind the Picture Profile recipes and Sony's marketing CDN behind
 * the Creative Look ones. Byte-for-byte they are the same files that were
 * uploaded to Storage — sampled against it before the quota ran out, sizes
 * matched to within re-encoding metadata.
 *
 * Idempotent: re-running overwrites the same paths and rewrites
 * `data/images.seed.json` complete. Dead source URLs are reported and skipped,
 * never written as a broken row.
 *
 * The Creative Look photographs are Sony's, credited to the named photographers
 * in `data/sony-asia-credits.json`. That credit is what the recipe descriptions
 * carry, and it should stay attached wherever these are displayed.
 *
 * Run: npm run vendor:images
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { get as httpsGet } from 'node:https';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { toRecipeId } from '../src/lib/legacy/migrate';

const OUT_DIR = join('public', 'recipes');

/**
 * The rungs, and they are the loader's too — `catalogue-loader.ts` swaps the
 * suffix rather than calling an optimizer, so this list and `LOCAL_WIDTHS`
 * there must agree. Chosen from what the layouts actually render:
 *
 *   320   lightbox filmstrip (48px) and its prev/next previews (128-176px)
 *   640   the grid card and the collage's non-hero tiles
 *  1024   the collage hero and the lightbox's own frame
 *
 * Three rungs at q72 is ~16MB for the catalogue. Two would have been ~11MB, but
 * it would have served the grid — the hottest surface here, and the one whose
 * bytes every visitor pays — from the 1024 rung: 2.5MB to scroll rather than
 * 1.4MB. `AGENTS.md` already spends repo weight on reader bytes for the fonts;
 * this is the same trade.
 */
const WIDTHS = [320, 640, 1024] as const;
const QUALITY = 72;

/**
 * How many downloads are in flight at once, and how hard to retry.
 *
 * Six concurrent was too many: Google Photos stopped answering partway through
 * the first run and 34 of 180 photographs failed with ETIMEDOUT — not a 404,
 * not a signed-URL expiry, just the host declining a burst. The failures were
 * silent in the sense that mattered, because the script writes the seed from
 * whatever it got, so it produced a *plausible* catalogue missing ten recipes.
 * Three in flight with backoff gets all of them.
 */
const CONCURRENCY = 3;
const ATTEMPTS = 4;
const BACKOFF_MS = [0, 1_500, 4_000, 9_000];
const REQUEST_TIMEOUT_MS = 30_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One GET, over IPv4, following redirects.
 *
 * `node:https` rather than `fetch`, for one reason: this machine has AAAA
 * records for `lh3.googleusercontent.com` but no working IPv6 route, and global
 * `fetch` offers no way to say `family: 4`. curl gets there by Happy Eyeballs
 * and fetch does not, so every Picture Profile photograph failed with a
 * 300ms ETIMEDOUT while curl fetched the same URL in two seconds. Neither
 * `--dns-result-order=ipv4first` nor `dns.setDefaultResultOrder` moved it;
 * `https.get({ family: 4 })` fixed it outright.
 */
function get(url: string, redirects = 0): Promise<{ body: Buffer } | { failure: string }> {
  return new Promise((resolve) => {
    if (redirects > 5) return resolve({ failure: 'too many redirects' });
    const u = new URL(url);
    const req = httpsGet(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        family: 4,
        timeout: REQUEST_TIMEOUT_MS,
        headers: { accept: 'image/*,*/*' },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve(get(new URL(res.headers.location, url).toString(), redirects + 1));
        }
        if (status !== 200) {
          res.resume();
          return resolve({ failure: String(status) });
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ body: Buffer.concat(chunks) }));
        res.on('error', (e) => resolve({ failure: e.message }));
      },
    );
    req.on('error', (e) => resolve({ failure: (e as NodeJS.ErrnoException).code ?? e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ failure: 'timeout' });
    });
  });
}

/** Retries, because a burst refusal is not a dead URL. */
async function download(url: string): Promise<{ body: Buffer } | { failure: string }> {
  let last = 'network';
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (BACKOFF_MS[attempt]) await sleep(BACKOFF_MS[attempt]);
    const res = await get(url);
    if ('body' in res) return res;
    /* A 404 or 403 is a genuinely dead source and retrying only wastes time; a
       429, a 5xx or a timeout is exactly what the backoff is for. */
    if (res.failure === '404' || res.failure === '403') return res;
    last = res.failure;
  }
  return { failure: `${last} after ${ATTEMPTS} attempts` };
}

/** Pulls the id -> [url] map straight out of the legacy JS module. */
function legacyImageMap(): Record<string, string[]> {
  const src = readFileSync('src/lib/legacy/images.legacy.js', 'utf8');
  const map: Record<string, string[]> = {};
  for (const m of src.matchAll(/"(scl-\d+|PROCOLOR-\d+)":\s*\[([\s\S]*?)\]/g)) {
    map[m[1]] = [...m[2].matchAll(/"(https?:[^"]+)"/g)].map((x) => x[1]);
  }
  return map;
}

/**
 * Creative Look photos, keyed by the recipe id the importer already assigned.
 * Unlike the legacy map these need no id translation — `emit-seed` wrote the
 * canonical `SCL-CL-0xx` alongside each credit.
 */
function sonyAsiaImageMap(): Record<string, string[]> {
  const credits = JSON.parse(readFileSync('data/sony-asia-credits.json', 'utf8')) as {
    recipeId: string;
    imageUrls: string[];
  }[];
  return Object.fromEntries(credits.map((c) => [c.recipeId, c.imageUrls]));
}

const isPlaceholder = (url: string) => url.includes('placehold.co');

type Row = { recipeId: string; storagePath: string; sort: number };
type Job = { recipeId: string; sort: number; url: string };

const skipped: string[] = [];

/** Downloads one photograph and writes every rung of it. Returns its seed row. */
async function vendor(job: Job): Promise<Row | null> {
  const res = await download(job.url);
  if ('failure' in res) {
    skipped.push(`${job.recipeId} <- ${res.failure} ${job.url.slice(0, 70)}`);
    return null;
  }

  const bytes = res.body;
  const stem = `${job.recipeId}/${String(job.sort).padStart(2, '0')}`;

  for (const width of WIDTHS) {
    const out = join(OUT_DIR, `${stem}-${width}.webp`);
    mkdirSync(dirname(out), { recursive: true });
    try {
      /* `withoutEnlargement` so a source narrower than a rung is stored at its
         own size rather than upscaled — the file stays honest about what it
         holds, and the loader's suffix swap still finds it. */
      const buf = await sharp(bytes)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 6 })
        .toBuffer();
      writeFileSync(out, buf);
    } catch (e) {
      skipped.push(`${job.recipeId} <- encode failed at ${width}w: ${(e as Error).message}`);
      return null;
    }
  }

  process.stdout.write('.');
  /* The seed carries the LARGEST rung. It is what a caller gets if nothing
     rewrites the path — a plain `<img src>`, an OG card, a crawler — and being
     too large there is a cost, while being too small is a visible defect. */
  return { recipeId: job.recipeId, storagePath: `${stem}-${WIDTHS[WIDTHS.length - 1]}.webp`, sort: job.sort };
}

async function main() {
  // Both libraries, already keyed by canonical recipe id.
  const sources: Record<string, string[]> = {
    ...Object.fromEntries(
      Object.entries(legacyImageMap()).map(([legacyId, urls]) => [toRecipeId(legacyId), urls]),
    ),
    ...sonyAsiaImageMap(),
  };

  const jobs: Job[] = [];
  for (const [recipeId, urls] of Object.entries(sources)) {
    // Placeholders were never photographs — carrying them over would dress up
    // "no image yet" as content.
    const real = urls.filter((u) => !isPlaceholder(u));
    if (real.length === 0) {
      skipped.push(`${recipeId} (placeholder only)`);
      continue;
    }
    real.forEach((url, sort) => jobs.push({ recipeId, sort, url }));
  }

  /* Rebuilt from scratch, so a photograph dropped from a source library does
     not linger in `public/` forever as an orphan nothing references. */
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Vendoring ${jobs.length} photographs at ${WIDTHS.join('/')}w …`);

  const rows: Row[] = [];
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = await Promise.all(jobs.slice(i, i + CONCURRENCY).map(vendor));
    rows.push(...batch.filter((r): r is Row => r !== null));
  }
  console.log('');

  /* `sort` stays the source index, holes and all, rather than being renumbered
     to close them. Renumbering would have to happen after every download has
     either landed or failed, while the filenames were already written from the
     index — so the seed would point at paths that do not exist the moment one
     URL 404s. A hole is harmless: `imagesFor()` orders by this value and takes
     the lowest as the grid thumbnail, and neither cares that it counts 0,1,3. */
  const seed = rows
    .slice()
    .sort((a, b) => a.recipeId.localeCompare(b.recipeId) || a.sort - b.sort);

  const recipes = new Set(seed.map((r) => r.recipeId)).size;

  if (skipped.length) {
    console.log(`\n${skipped.length} skipped:`);
    for (const s of skipped) console.log(`  - ${s}`);
  }

  /* Refuse to shrink the catalogue.
     The first run of this script lost 34 photographs and ten whole recipes to a
     burst of ETIMEDOUTs, and wrote the seed anyway — a file that parses, builds
     and renders, just with a tenth of the catalogue quietly unphotographed.
     Nothing downstream could have caught that: a missing image is a dangerously
     valid state here, because most recipes legitimately have none. So the guard
     belongs at the only point that knows what there was before. */
  const previous = JSON.parse(readFileSync('data/images.seed.json', 'utf8')) as Row[];
  const before = new Set(previous.map((r) => r.recipeId));
  const after = new Set(seed.map((r) => r.recipeId));
  const lost = [...before].filter((id) => !after.has(id));

  if (lost.length && !process.argv.includes('--allow-shrink')) {
    console.error(
      `\n✗ Refusing to write: ${lost.length} recipe(s) that had photographs now have none —\n` +
        `  ${lost.join(', ')}\n` +
        `  The seed on disk is unchanged. Re-run; the sources throttle rather than 404, so\n` +
        `  a second pass usually collects them. Pass --allow-shrink if the loss is intended.`,
    );
    process.exit(1);
  }

  writeFileSync('data/images.seed.json', JSON.stringify(seed, null, 2) + '\n');
  console.log(`✓ ${seed.length} photographs × ${WIDTHS.length} rungs, covering ${recipes} recipes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
