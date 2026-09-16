import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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

const MUTATING_ROUTES = [
  ...PRODUCT_ROUTES,
  ...ARTICLE_ROUTES,
  ...RECIPE_ROUTES,
  'src/app/api/admin/articles/upload/route.ts',
];

const read = (path: string) => readFileSync(path, 'utf8');

/**
 * Just the bodies of the exported handlers.
 *
 * Ordering assertions have to be made inside a handler, not across the file: a
 * module-level helper that calls `contentAdmin()` sits above every handler in
 * the source and would make "the freeze comes first" look false while being
 * perfectly true of every request.
 */
function handlerBodies(source: string): string {
  const first = source.search(/export async function (GET|POST|PATCH|DELETE)\(/);
  return first === -1 ? '' : source.slice(first);
}

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

  it('refuses while writes are frozen, before the body is read', () => {
    const body = handlerBodies(source);
    const freeze = body.indexOf('contentAdminWritesFrozen()');
    expect(freeze).toBeGreaterThan(-1);
    for (const work of [/request\.json\(\)/, /request\.formData\(\)/, /contentAdmin\(\)/]) {
      const at = body.search(work);
      if (at === -1) continue;
      expect(at).toBeGreaterThan(freeze);
    }
  });

  it('authorises before it checks the freeze, so the flag leaks nothing', () => {
    /* An anonymous caller must not be able to probe whether a cutover is in
       progress; they get the same 403 either way. */
    const body = handlerBodies(source);
    expect(body.indexOf('adminGate(request)')).toBeLessThan(
      body.indexOf('contentAdminWritesFrozen()'),
    );
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
    const calls = [...source.matchAll(/revalidateTag\(LAB_TAG, IMMEDIATE\)/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const before = source.slice(0, call.index);
      /* Each invalidation is preceded by a catch that returned 502, so it is
         unreachable unless the write committed. */
      expect(before).toMatch(/status: 502/);
    }
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
    /* Per call rather than `lastIndexOf('status: 502')`: these files hold
       three handlers, so the last 502 in the file belongs to DELETE and sits
       below PATCH's invalidation while being nothing to do with it. Asking
       "is every invalidation preceded by a failure path that returned" is the
       property actually wanted, and it survives a fourth handler. */
    const calls = [...source.matchAll(/revalidateTag\(CATALOGUE_TAG, IMMEDIATE\)/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(source.slice(0, call.index)).toMatch(/status: 502/);
    }
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
    const calls = [...source.matchAll(/seedRecipes\(\)/g)];
    expect(calls.length).toBeGreaterThan(1);
    for (const call of calls) {
      /* Each use is followed, within the same expression, by a published
         check — `.filter(r => r.published …)` or `&& r.published`. */
      const after = source.slice(call.index, call.index + 200);
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
