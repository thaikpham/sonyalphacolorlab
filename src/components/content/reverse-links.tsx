import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { RecipeFormat } from '@/lib/camera/constants'
import { conceptsForRecipe } from '@/lib/content/concepts'
import {
  entriesReferencing,
  knowledgeExplaining,
  pageTarget,
  type LinkTarget,
} from '@/lib/content/relations'
import { loadUniverse } from '@/lib/content/universe'
import { ARTICLE_LANG } from '@/lib/lab/articles'
import type { Locale } from '@/lib/recipes/source'
import { RelatedLinks } from './related-links'

/**
 * Links *into* a recipe or a product page from the editorial side, computed
 * rather than authored (ADR 0002): the pages that name this entity among
 * their related links, and — for a recipe — the reference pages that explain
 * the concepts its format uses. Nobody edits a recipe to add these; publishing
 * the article is what makes them appear, and unpublishing it is what removes
 * them.
 */

const MAX_EXPLAINERS = 4

function dedupe(links: readonly LinkTarget[]): LinkTarget[] {
  const seen = new Set<string>()
  return links.filter((l) => {
    const key = `${l.kind}:${l.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Under a recipe's parameter tables. Never empty: the glossary entries for the
 * recipe's own format always exist, so the section always has somewhere to
 * send a reader who wants to know what a row means.
 */
export async function RecipeLearnMore({
  recipeId,
  format,
  locale,
}: {
  recipeId: string
  format: RecipeFormat
  locale: Locale
}) {
  const [t, { entries, unavailable }] = await Promise.all([
    getTranslations('learn'),
    loadUniverse(locale),
  ])
  const links = dedupe([
    ...knowledgeExplaining(conceptsForRecipe(format), entries)
      .slice(0, MAX_EXPLAINERS)
      .map(pageTarget),
    ...entriesReferencing({ kind: 'recipe', id: recipeId }, entries).map(pageTarget),
  ])

  return (
    <section aria-labelledby="learn-more" className="surface flex flex-col gap-4 p-5">
      <h2 id="learn-more" className="label">
        {t('learnMore')}
      </h2>
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href={`/learn/glossary#${format}`} className="chip chip-action">
            {t('glossaryTitle')} · {format === 'pp' ? 'Picture Profile' : 'Creative Look'}
          </Link>
        </li>
        <li>
          <Link href="/learn/glossary#wb" className="chip chip-action">
            {t('glossaryTitle')} · White Balance
          </Link>
        </li>
      </ul>
      <RelatedLinks
        links={links}
        unavailable={unavailable.includes('pages')}
        heading={t('related')}
        headingLevel={3}
        lang={ARTICLE_LANG}
      />
    </section>
  )
}

/**
 * On a product page: the articles and reference pages that name it. Renders
 * nothing when there are none — a camera page with an empty "Articles"
 * heading reads as a page that failed to load.
 */
export async function ProductArticles({ productId, locale }: { productId: string; locale: Locale }) {
  const [t, { entries, unavailable }] = await Promise.all([
    getTranslations('learn'),
    loadUniverse(locale),
  ])
  const links = entriesReferencing({ kind: 'product', id: productId }, entries).map(pageTarget)
  if (links.length === 0 && !unavailable.includes('pages')) return null

  return (
    <div className="surface p-5">
      <RelatedLinks
        links={links}
        unavailable={unavailable.includes('pages')}
        heading={t('forThisProduct')}
        lang={ARTICLE_LANG}
      />
    </div>
  )
}
