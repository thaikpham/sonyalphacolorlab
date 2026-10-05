/**
 * Cross-links between entities, resolved at read time (ADR 0002).
 *
 * Pure functions over lists the caller has already loaded, so the rule that
 * matters most — a link to something a reader cannot open renders nothing —
 * is tested here without a database. The lists are the same published reads
 * the pages use, which is what makes unpublishing hide every link to a page on
 * the very next request: the write route invalidates the tag those reads sit
 * behind, and there is no second copy of "what exists" to go stale.
 */

import type { ConceptKey } from './concepts'
import type { Article, ArticleMeta, ContentRef, ContentRefKind } from '@/lib/lab/types'
import { modelCode } from '@/lib/cameras/aliases'

/** A link a page can render. `href` is locale-free; the caller's `Link` adds it. */
export type LinkTarget = {
  readonly kind: ContentRefKind
  readonly id: string
  readonly title: string
  readonly href: string
  /** One short line: recipe format and White Balance, a model code, a section. */
  readonly subtitle?: string
}

export type RecipeSummary = {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly format: 'pp' | 'cl'
  readonly wbLabel: string
  readonly look?: string
}

export type ProductSummary = {
  readonly id: string
  readonly name: string
  /** "Sony 6400 (ILCE-6400/B AP2)". The display title drops the SKU. */
  readonly fullName?: string
  readonly sku: string
  readonly category: string
}

export type Universe = {
  /** A ref, if its target is currently readable. */
  readonly get: (ref: ContentRef) => LinkTarget | undefined
  /** An article or knowledge page by id, whichever it is. */
  readonly page: (id: string) => LinkTarget | undefined
}

export function recipeTarget(r: RecipeSummary): LinkTarget {
  return {
    kind: 'recipe',
    id: r.id,
    title: r.name,
    href: `/recipe/${r.slug}`,
    subtitle: `${r.format === 'pp' ? 'Picture Profile' : `Creative Look${r.look ? ` ${r.look}` : ''}`} · ${r.wbLabel}`,
  }
}

/**
 * The catalogue's own full name without its trailing SKU — "Sony 6400" rather
 * than a bare "6400", which out of the catalogue's context reads as a number.
 * The model code goes in the subtitle instead.
 */
function productTitle(p: ProductSummary): string {
  const full = p.fullName?.replace(/\s*\([^)]*\)\s*$/, '').trim()
  return full || p.name
}

export function productTarget(p: ProductSummary): LinkTarget {
  const code = modelCode(p.sku)
  return {
    kind: 'product',
    id: p.id,
    title: productTitle(p),
    href: p.category === 'audio' ? `/audio/${p.id}` : `/cameras/${p.id}`,
    ...(code ? { subtitle: code } : {}),
  }
}

export function pageTarget(a: Pick<Article, 'id' | 'kind' | 'title'>): LinkTarget {
  return {
    kind: a.kind,
    id: a.id,
    title: a.title,
    href: a.kind === 'knowledge' ? `/learn/${a.id}` : `/blog/${a.id}`,
  }
}

export function buildUniverse(input: {
  readonly entries: readonly Article[]
  readonly recipes: readonly RecipeSummary[]
  readonly products: readonly ProductSummary[]
}): Universe {
  const recipes = new Map(input.recipes.map((r) => [r.id, recipeTarget(r)]))
  const products = new Map(input.products.map((p) => [p.id, productTarget(p)]))
  const pages = new Map(input.entries.map((a) => [a.id, pageTarget(a)]))

  return {
    get(ref) {
      switch (ref.kind) {
        case 'recipe':
          return recipes.get(ref.id)
        case 'product':
          return products.get(ref.id)
        case 'article':
        case 'knowledge': {
          /* The kind on the ref must match the page's real kind. A ref that
             says `article` for a knowledge page was written against a page
             that has since moved, and its href would be wrong. */
          const page = pages.get(ref.id)
          return page && page.kind === ref.kind ? page : undefined
        }
      }
    },
    page: (id) => pages.get(id),
  }
}

/** Forward links in authored order, unresolvable ones dropped, no repeats. */
export function resolveRefs(refs: readonly ContentRef[], universe: Universe): LinkTarget[] {
  const seen = new Set<string>()
  const out: LinkTarget[] = []
  for (const ref of refs) {
    const target = universe.get(ref)
    const key = `${ref.kind}:${ref.id}`
    if (!target || seen.has(key)) continue
    seen.add(key)
    out.push(target)
  }
  return out
}

export function resolvePrerequisites(ids: readonly string[], universe: Universe): LinkTarget[] {
  return ids.map((id) => universe.page(id)).filter((t): t is LinkTarget => Boolean(t))
}

/** Published pages that name `target` among their related links. */
export function entriesReferencing(
  target: ContentRef,
  entries: readonly Article[],
): readonly Article[] {
  return entries.filter((a) =>
    a.meta.related.some((r) => r.kind === target.kind && r.id === target.id),
  )
}

/**
 * Knowledge pages that explain any of `concepts`, best match first: the page
 * covering the most of them leads, then the hub's own order. Articles are not
 * returned — a concept link from a recipe table points at a reference, and an
 * article reaches the recipe through `related` instead.
 */
export function knowledgeExplaining(
  concepts: readonly ConceptKey[],
  entries: readonly Article[],
): readonly Article[] {
  const wanted = new Set<string>(concepts)
  return entries
    .filter((a) => a.kind === 'knowledge')
    .map((a) => ({ a, hits: a.meta.concepts.filter((c) => wanted.has(c)).length }))
    .filter((x) => x.hits > 0)
    .sort(
      (x, y) =>
        y.hits - x.hits ||
        (x.a.meta.order ?? 999) - (y.a.meta.order ?? 999) ||
        x.a.title.localeCompare(y.a.title),
    )
    .map((x) => x.a)
}

/**
 * The references in `meta` whose target does not exist at all — not even as a
 * draft. Used on save so a typo is reported to the editor; a reference to a
 * draft is allowed and simply renders once that page is published.
 */
export function unknownRefs(
  meta: Pick<ArticleMeta, 'related' | 'prerequisites'>,
  known: {
    readonly recipes: ReadonlySet<string>
    readonly products: ReadonlySet<string>
    /** Every article and knowledge id, drafts included, with its kind. */
    readonly pages: ReadonlyMap<string, 'article' | 'knowledge'>
  },
): ContentRef[] {
  const missing: ContentRef[] = []
  for (const ref of meta.related) {
    const ok =
      ref.kind === 'recipe'
        ? known.recipes.has(ref.id)
        : ref.kind === 'product'
          ? known.products.has(ref.id)
          : known.pages.get(ref.id) === ref.kind
    if (!ok) missing.push(ref)
  }
  for (const id of meta.prerequisites) {
    const kind = known.pages.get(id)
    if (!kind) missing.push({ kind: 'article', id })
  }
  return missing
}
