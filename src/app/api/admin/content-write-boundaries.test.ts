import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MUTATING_VERBS, routeHandlers, type Handler } from './route-handlers';

/**
 * Where an administrator's save goes, and when the caches learn about it.
 *
 * Three separate defects share this file because they share a cause — the order
 * of operations inside a write handler:
 *
 * 1. **Wrong project.** A catalogue or article write must reach the *content*
 *    plane. The control secret has no business touching `sony_cameras`, and
 *    after the split there is no such table there to touch.
 * 2. **No invalidation.** The catalogue reads sit behind a tagged Data Cache
 *    with a sixty-second interval. A write that commits without invalidating
 *    looks perfect from the route — the row is there, the response says ok —
 *    and the editor stares at their old value for a minute and saves again.
 * 3. **Invalidation on failure.** The mirror image, and the sneakier one: it
 *    throws away a warm cache to re-render exactly the same rows, and it makes
 *    a failed save look like it half-worked.
 *
 * Source assertions rather than request tests, like every sibling file here:
 * these handlers need two live projects to execute, and what must hold is a
 * property of the code.
 */

const PRODUCT_ROUTES = [
  'src/app/api/admin/products/route.ts',
  'src/app/api/admin/products/[id]/route.ts',
];

const ARTICLE_ROUTES = [
  'src/app/api/admin/articles/route.ts',
  'src/app/api/admin/articles/[id]/route.ts',
];

const RECIPE_ROUTES = [
  'src/app/api/admin/recipes/route.ts',
  'src/app/api/admin/recipes/[id]/route.ts',
];

/**
 * The photograph routes are mutating but deliberately do NOT invalidate.
 *
 * An upload goes to a PRIVATE bucket and is not on the site: readers are served
 * from `public/recipes`, and a file arrives there only when
 * `npm run vendor:uploads` runs and the result is deployed. So a
 * `revalidateTag` here would throw away warm cache entries in order to
 * re-render byte-identical pages. They are held apart from RECIPE_ROUTES for
 * that reason and get their own assertion below.
 */
const RECIPE_IMAGE_ROUTES = [
  'src/app/api/admin/recipes/[id]/images/route.ts',
  'src/app/api/admin/recipes/[id]/images/[imageId]/route.ts',
];

const MUTATING_ROUTES = [
  ...PRODUCT_ROUTES,
  ...ARTICLE_ROUTES,
  ...RECIPE_ROUTES,
  ...RECIPE_IMAGE_ROUTES,
  'src/app/api/admin/articles/upload/route.ts',
];

const read = (path: string) => readFileSync(path, 'utf8');

/**
 * The source with its comments removed.
 *
 * Every assertion in this file is about what the code does, and these files are
 * heavily commented by house style — so a prose mention of `seedRecipes()` or
 * `revalidateTag` reads to a regex exactly like a call. That is not a
 * hypothetical: the comment explaining why `imagesFor()` mirrors
 * `seedRecipes()` broke the assertion below the day it was written.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * The handlers that write, each on its own slice.
 *
 * Ordering assertions have to be made inside ONE handler. Across the file, a
 * module-level helper that calls `contentAdmin()` makes "the freeze comes
 * first" look false while it is true of every request — and the first handler
 * answers for the rest: PATCH's freeze check stood in for DELETE's, so a
 * cutover delete that skipped the freeze passed.
 */
const writers = (source: string) => routeHandlers(source).filter((h) => MUTATING_VERBS.has(h.verb));

/** What is wrong with one write handler's freeze, or nothing. */
function freezeProblems({ verb, body }: Handler): string[] {
  const freeze = body.indexOf('contentAdminWritesFrozen()');
  if (freeze === -1) return [`${verb} never checks contentAdminWritesFrozen()`];
  const problems: string[] = [];
  const gate = body.indexOf('adminGate(request)');
  /* An anonymous caller must not be able to probe whether a cutover is in
     progress; they get the same 403 either way. */
  if (gate === -1 || gate > freeze) problems.push(`${verb} checks the freeze before its gate`);
  for (const work of [/request\.json\(\)/, /request\.formData\(\)/, /contentAdmin\(\)/]) {
    const at = body.search(work);
    if (at !== -1 && at < freeze) problems.push(`${verb} reaches ${work} before the freeze`);
  }
  return problems;
}

/**
 * Whether every invalidation in one handler sits below a failure return of
 * that same handler. Per handler, because GET opens every one of these files
 * with its own `status: 502` for a failed read, and a file-wide look found it
 * above every write's invalidation whether the write had a failure path or not.
 */
function invalidationProblems({ verb, body }: Handler, call: RegExp): string[] {
  return [...body.matchAll(new RegExp(call.source, 'g'))]
    .filter((m) => !/status: 502/.test(body.slice(0, m.index)))
    .map(() => `${verb} invalidates above its own 502`);
}

describe('the per-handler write checks', () => {
  const fixture = [
    'export async function GET(request: Request) {',
    '  const gate = await adminGate(request);',
    '  if (!gate.ok) return NextResponse.json({}, { status: gate.status });',
    "  if (loadFailed) return NextResponse.json({}, { status: 502 });",
    '}',
    '',
    'export async function PATCH(request: Request) {',
    '  const gate = await adminGate(request);',
    '  if (!gate.ok) return NextResponse.json({}, { status: gate.status });',
    '  if (contentAdminWritesFrozen()) return frozen();',
    '  revalidateTag(CATALOGUE_TAG, IMMEDIATE);',
    '  const body = await request.json();',
    '}',
    '',
    'export async function DELETE(request: Request) {',
    '  const gate = await adminGate(request);',
    '  if (!gate.ok) return NextResponse.json({}, { status: gate.status });',
    '  await contentAdmin().from("recipes").update({ published: false });',
    '}',
  ].join('\n');
  const [patch, del] = writers(fixture);

  it('flags a DELETE with no freeze although PATCH has one', () => {
    expect(freezeProblems(patch)).toEqual([]);
    expect(freezeProblems(del)).toEqual(['DELETE never checks contentAdminWritesFrozen()']);
  });

  it('flags a PATCH that invalidates although only GET has a 502', () => {
    expect(invalidationProblems(patch, /revalidateTag\(CATALOGUE_TAG, IMMEDIATE\)/)).toEqual([
      'PATCH invalidates above its own 502',
    ]);
  });
});

describe.each(MUTATING_ROUTES)('%s', (path) => {
  const source = read(path);

  it('never writes content with the control credential', () => {
    expect(source).not.toMatch(/controlAdmin\(\)/);
    expect(source).not.toMatch(/controlRead\(\)/);
  });

  it('never forwards the caller bearer token to the content project', () => {
    /* The content project has no Auth and no shared JWT secret, so a
       control-plane token means nothing there. Attaching one would be a
       credential travelling to a system that cannot validate it — and would
       imply the content project should learn to, which the spec forbids. */
    expect(source).not.toMatch(/Authorization|global:\s*\{\s*headers/);
  });

  it('refuses in every write handler while writes are frozen, after the gate and before the body', () => {
    const handlers = writers(source);
    expect(handlers.length).toBeGreaterThan(0);
    for (const handler of handlers) expect(freezeProblems(handler)).toEqual([]);
  });
});

describe.each(PRODUCT_ROUTES)('%s', (path) => {
  const source = read(path);

  it('writes sony_cameras through the content service client', () => {
    expect(source).toMatch(/contentAdmin\(\)[\s\S]{0,40}\.from\(\s*'sony_cameras'\s*\)/);
  });

  it('invalidates the catalogue tag immediately after a successful write', () => {
    expect(source).toMatch(/revalidateTag\(CATALOGUE_TAG, IMMEDIATE\)/);
  });

  it('does not invalidate on a failed write', () => {
    /* Structural: every `revalidateTag` must sit after the last early return
       that answers 502. A call above one is reachable on the failure path. */
    const lastFailure = source.lastIndexOf("{ status: 502 }");
    const invalidate = source.indexOf('revalidateTag(CATALOGUE_TAG');
    expect(lastFailure).toBeGreaterThan(-1);
    expect(invalidate).toBeGreaterThan(lastFailure);
  });
});

describe.each(ARTICLE_ROUTES)('%s', (path) => {
  const source = read(path);

  it('invalidates the blog tag, not the catalogue one', () => {
    /* Separate tags on purpose: the product catalogue and the blog are edited
       by different people at different rates, and one shared tag would mean an
       editor saving a lens spec throws away the blog's cache too. */
    expect(source).toMatch(/revalidateTag\(LAB_TAG, IMMEDIATE\)/);
    expect(source).not.toMatch(/revalidateTag\(CATALOGUE_TAG/);
  });

  it('invalidates only after the store call returned', () => {
    /* Each invalidation is preceded, in its own handler, by a catch that
       returned 502, so it is unreachable unless the write committed. */
    const call = /revalidateTag\(LAB_TAG, IMMEDIATE\)/;
    expect(source).toMatch(call);
    for (const handler of writers(source)) expect(invalidationProblems(handler, call)).toEqual([]);
  });
});

describe.each(RECIPE_ROUTES)('%s', (path) => {
  const source = read(path);

  it('invalidates the catalogue tag, which is the one recipe reads sit behind', () => {
    /* `source.ts` wraps all four readers in `catalogueCache`, so a recipe save
       that fired `LAB_TAG` would commit, answer ok, and leave the editor
       looking at their old colour science for sixty seconds. */
    expect(source).toMatch(/revalidateTag\(CATALOGUE_TAG, IMMEDIATE\)/);
    expect(source).not.toMatch(/revalidateTag\(LAB_TAG/);
  });

  it('invalidates only after the store call returned', () => {
    /* Per call and per handler rather than `lastIndexOf('status: 502')`:
       these files hold three handlers, so the last 502 in the file belongs to
       DELETE and sits below PATCH's invalidation while being nothing to do
       with it — and the first 502 belongs to GET, above everything. Asking "is
       every invalidation preceded by a failure path its own handler returned"
       is the property actually wanted, and it survives a fourth handler. */
    const call = /revalidateTag\(CATALOGUE_TAG, IMMEDIATE\)/;
    expect(source).toMatch(call);
    for (const handler of writers(source)) expect(invalidationProblems(handler, call)).toEqual([]);
  });
});

describe.each(RECIPE_IMAGE_ROUTES)('%s', (path) => {
  const source = read(path);

  it('invalidates only where an image write is actually live', () => {
    /* Deployed, nothing these routes write is on the site: the bucket is
       private, the origin is `public/recipes`, and the door between them is a
       vendor run and a deploy. Offline in development the bytes land in
       `public/recipes-dev`, which `imagesFor()` reads, so the same write IS
       live and the sixty-second catalogue cache is the only thing hiding it.
       So the rule is not "never invalidate" but "invalidate exactly where a
       reader would see something different" — and every call must go through
       the guard that encodes it. */
    const body = code(path);
    const calls = [...body.matchAll(/revalidateTag\(/g)];
    for (const call of calls) {
      const enclosing = body.slice(Math.max(0, call.index - 200), call.index);
      expect(enclosing, 'a revalidateTag outside isRecipeDevStore()').toMatch(
        /isRecipeDevStore\(\)/,
      );
    }
    /* And the handlers reach it only through the named helper, so a future
       handler cannot quietly add a bare call beside it. */
    expect(source).toMatch(/function revalidateOffline\(\)/);
  });

  it('never makes the private intake bucket public', () => {
    /* The 2026-09-11 incident in one line. A reader fetching a recipe
       photograph from Storage is what spent the egress quota and restricted
       Auth along with it. */
    expect(source).not.toMatch(/getPublicUrl|PUBLIC_BUCKET|'recipes'\s*\)/);
  });

  it('tells the editor the photograph is not live yet', () => {
    /* The single fact an editor cannot see for themselves, so it is carried in
       the response rather than left to the UI to remember. */
    expect(source).toMatch(/pendingVendor/);
  });
});

describe('the recipe image store', () => {
  const source = read('src/lib/recipes/image-store.ts');

  it('writes only to the private intake bucket', () => {
    expect(source).toMatch(/RECIPE_UPLOAD_BUCKET/);
    expect(source).not.toMatch(/getPublicUrl/);
    expect(source).not.toMatch(/controlAdmin|controlRead/);
  });

  it('uploads the objects before the row that names them', () => {
    /* `recipe_images` has no status column to mark a row as not-yet-backed, so
       the ordering is the safety: bytes with no row cost storage and nothing
       else, while a row with no bytes fails the next vendor run and blocks a
       deploy. */
    const upload = source.indexOf('bucket.upload(');
    const insert = source.indexOf(".from('recipe_images')\n    .insert(");
    expect(upload).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(upload);
  });

  it('never persists a signed preview URL', () => {
    /* A signed URL carries an expiry. Stored in a row it becomes a broken
       image in half an hour. */
    expect(source).not.toMatch(/(storage_path|storagePath):\s*.*signedUrl/);
  });
});

describe('the recipe store', () => {
  const source = read('src/lib/recipes/admin-store.ts');

  it('reads and writes recipes on the content plane', () => {
    expect(source).toMatch(/contentAdmin\(\)[\s\S]{0,80}recipes/);
    expect(source).not.toMatch(/controlAdmin|controlRead/);
  });

  it('uses the local file store only when there is no Supabase at all', () => {
    expect(source).toMatch(/isRecipeDevStore\(\)/);
  });

  it('never issues a hard delete', () => {
    /* `recipe_comments`, `recipe_proposals`, `proposal_votes` and
       `community_photos` live on the CONTROL project and reference
       `recipe_slug` as a plain string. Postgres cannot cascade across two
       projects in two organisations, so `delete from recipes` orphans four
       tables with no error and nothing to find them by. Unpublishing is the
       only removal this domain has. */
    expect(source).not.toMatch(/\.delete\(\)/);
    expect(source).toMatch(/export async function unpublishRecipe/);
  });

  it('keeps the slug out of every update it sends', () => {
    /* Same cross-project reason, from the other direction: renaming a slug
       orphans the rows that point at it. The column is destructured out of the
       patch rather than sent unchanged, because a patch that names a column is
       a patch that can change it. */
    expect(source).toMatch(/const \{ slug: _slug, legacy_id: _legacyId, \.\.\.patch \} = row/);
  });

  it('makes a missing row an error rather than a silent success', () => {
    /* An `update ... where id = ?` matching nothing is a success in PostgREST:
       no error, zero rows. `.select('id')` is what turns that into a 404. */
    expect(source).toMatch(/\.select\('id'\)/);
  });
});

describe('the recipe reading path', () => {
  const source = read('src/lib/recipes/source.ts');
  const body = code('src/lib/recipes/source.ts');

  it('reaches the development store only behind the two-part guard', () => {
    /* `/admin/colorlab` writing to a file that `/colorlab` cannot read is a
       half-feature: the editor works offline and its results are invisible. So
       the offline catalogue is the dev store when one is engaged — and
       `isRecipeDevStore()` is the only way it is reached, because that is what
       keeps `NODE_ENV=test` and every production build on the compiled
       snapshot instead of a developer's scratch file. */
    expect(source).toMatch(/isRecipeDevStore\(\)/);
    expect(source).toMatch(/isRecipeDevStore\(\)\s*\?\s*devListRecipes\(\)/);
  });

  it('still filters every offline read to published rows', () => {
    /* The dev store holds drafts — that is its job. A reader path that stopped
       filtering would put an editor's unfinished recipe on the site the moment
       they typed a name. */
    const calls = [...body.matchAll(/seedRecipes\(\)/g)];
    expect(calls.length).toBeGreaterThan(1);
    for (const call of calls) {
      /* Each use is followed, within the same expression, by a published
         check — `.filter(r => r.published …)` or `&& r.published`. */
      const after = body.slice(call.index, call.index + 200);
      expect(after, `seedRecipes() at ${call.index} does not filter on published`).toMatch(
        /r\.published/,
      );
    }
  });
});

describe('the recipe development store', () => {
  const source = read('src/lib/recipes/dev-store.ts');

  it('cannot engage unless both halves hold', () => {
    expect(source).toMatch(/!hasContentConfig\(\) && process\.env\.NODE_ENV === 'development'/);
  });
});

describe('the article store', () => {
  const source = read('src/lib/lab/admin-store.ts');

  it('reads and writes lab_articles on the content plane', () => {
    expect(source).toMatch(/contentAdmin\(\)[\s\S]{0,80}lab_articles/);
    expect(source).not.toMatch(/controlAdmin|controlRead/);
  });

  it('uses the local file store only when there is no Supabase at all', () => {
    expect(source).toMatch(/isDevStore\(\)/);
  });
});

describe('the development store', () => {
  const source = read('src/lib/lab/dev-store.ts');

  it('cannot engage unless both halves hold', () => {
    /* A production deploy that lost its Supabase variables must not quietly
       become a filesystem-backed CMS holding articles nobody can see. Task 1
       made a partial configuration impossible, so `hasContentConfig()` is now
       an all-or-nothing signal — and `NODE_ENV` is still checked beside it. */
    expect(source).toMatch(/!hasContentConfig\(\) && process\.env\.NODE_ENV === 'development'/);
  });
});

describe('the neutral cache module', () => {
  const source = read('src/lib/catalogue-cache.ts');

  it('owns the immediate-expiry profile both domains use', () => {
    expect(source).toMatch(/export const IMMEDIATE = \{ expire: 0 \} as const/);
  });

  it('does not import anything from the blog', () => {
    /* The direction of the dependency is the point: the blog may reach for the
       shared profile, the shared module may not reach for the blog. */
    expect(source).not.toMatch(/^import .*lab/m);
  });
});


describe('the product update route', () => {
  const source = read('src/app/api/admin/products/[id]/route.ts');

  it('reads the row it is about to overwrite past every cache', () => {
    /* `getSonyProductById()` reads through the sixty-second catalogue cache.
       Two edits a minute apart were enough to lose one: the second filled the
       columns the body did not mention from a copy that predated the first,
       and upserted it away — both saves reporting success. */
    expect(source).not.toMatch(/getSonyProductById/);
    expect(source).toMatch(/currentProductRow/);
  });

  it('decides the category permission from that same fresh row', () => {
    const check = source.indexOf('canManageCategory(');
    const fresh = source.indexOf('await currentProductRow(');
    expect(fresh).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(fresh);
  });
});
