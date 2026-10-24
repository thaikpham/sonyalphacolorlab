/**
 * Everything searchable, as one shape (ADR 0003).
 *
 * Pure builders from the objects the pages already read — a `RecipeView`, a
 * `SonyCamera`, an `Article`, a glossary entry — to a `SearchDoc`. No index is
 * stored anywhere: the service builds these from the same cached, published
 * reads on every request, which is why an unpublished article cannot linger
 * in search after the page has gone.
 *
 * Kept free of server-only imports so the evaluation set can run the exact
 * production ranking over the seed corpus in a unit test.
 */

import { accentHex, type Accent } from '@/lib/camera/color'
import { CREATIVE_LOOKS } from '@/lib/camera/constants'
import type { Locale } from '@/lib/camera/explanations'
import { conceptTitle } from '@/lib/content/concepts'
import { ARTICLE_LANG, LEVELS, TOPICS } from '@/lib/lab/articles'
import { truncateOnWord } from '@/lib/lab/outline'
import type { Article, Block } from '@/lib/lab/types'
import { buildGlossary } from '@/lib/learn/glossary'
import { recipeIdAliases } from '@/lib/recipes/recipe-id'
import { taxonomyTerms, type RecipeTaxonomy } from '@/lib/recipes/taxonomy'
import { squash } from './text'
import type { SearchKind } from './types'

export type SearchDoc = {
  readonly kind: SearchKind
  readonly id: string
  readonly title: string
  readonly url: string
  readonly contentLanguage: string
  /** Squashed spellings that count as naming this entity exactly. */
  readonly exact: readonly string[]
  /** Squashed alternative names (camera aliases). */
  readonly aliases: readonly string[]
  /** Searchable text, by weight. */
  readonly titleText: string
  readonly summary: string
  readonly tags: readonly string[]
  readonly headings: readonly string[]
  readonly body: string
  /** Breaks a tie in favour of an authored page over a generated entry. */
  readonly boost: number
  /** What the snippet is cut from, when it is not the summary. */
  readonly snippetText?: string
  /** The snippet's language, when it is not `contentLanguage`. */
  readonly snippetLanguage?: string
  readonly display: {
    readonly subtitle?: string
    readonly badge?: string
    readonly imageUrl?: string
    readonly price?: string
    readonly accentHex?: string
  }
}

const SNIPPET_MAX = 160

const snippetOf = (text: string) => (text ? truncateOnWord(text, SNIPPET_MAX) : undefined)

/* --------------------------------------------------------------------- */
/* Recipes                                                                */
/* --------------------------------------------------------------------- */

export type RecipeForSearch = {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly format: 'pp' | 'cl'
  /** The Creative Look code, for a `cl` recipe. */
  readonly look?: string
  readonly wbLabel: string
  readonly description: string
  readonly tags: readonly string[]
  readonly accent?: Accent
  /** The browse taxonomy, when the caller has it (a `RecipeView` always does). */
  readonly situations?: RecipeTaxonomy['situations']
  readonly style?: RecipeTaxonomy['style']
  readonly tone?: RecipeTaxonomy['tone']
}

export function recipeDoc(r: RecipeForSearch, locale: Locale): SearchDoc {
  /* "PP-001-Vivid Nostalgia Film" — the code alone and the whole name are each an
     exact hit, and so is the id and the slug. A row still on the old
     "SCL-PP-001: Mojave Sun" shape (until the library sync reaches
     production) keeps its bare name as an exact hit too. */
  const bare = r.name.includes(': ') ? r.name.split(': ').slice(1).join(': ') : r.name
  const code = /^(PP|CL)-\d{3}/.exec(r.name)?.[0] ?? ''
  const look = r.format === 'cl' ? CREATIVE_LOOKS.find((l) => l.code === r.look) : undefined
  const formatLabel = r.format === 'pp' ? 'Picture Profile' : 'Creative Look'
  /* Every synonym of the recipe's situations, style and tone, both languages:
     "cafe", "chân dung", "phim", "đen trắng" land on it as tag hits. One
     ranking for the header, the grid and `/search` — the browse row is not a
     second engine, it is vocabulary the one engine already reads. */
  const inherited =
    r.situations && r.style && r.tone
      ? taxonomyTerms({ situations: r.situations, style: r.style, tone: r.tone })
      : []

  return {
    kind: 'recipe',
    id: r.id,
    title: r.name,
    url: `/recipe/${r.slug}`,
    /* Recipe names are never translated (Rule 3); the description follows the
       locale it was read in, and the snippet is cut from it. */
    contentLanguage: 'en',
    /* Both id spellings are exact hits: `PP-009`, and the `SCL-PP-009` the
       site displayed for years, whichever shape the row is stored in. */
    exact: [
      ...recipeIdAliases(r.id).map(squash),
      squash(code),
      squash(bare),
      squash(r.name),
      squash(r.slug),
    ].filter(Boolean),
    aliases: [],
    titleText: r.name,
    summary: r.description,
    tags: [
      /* The slug never changes, so it carries the name a reader learnt first
         ("Mojave Sun", "Raoul Rutnam") and the place an original was imagined
         for ("Đà Lạt"), now that the name itself is a mood. As a tag, a typo
         of it still reaches the recipe through the near-miss tier. */
      r.slug.replace(/-/g, ' '),
      ...r.tags.map((t) => t.replace(/-/g, ' ')),
      ...inherited,
      formatLabel,
      r.format.toUpperCase(),
      ...(look ? [look.code, look.label] : []),
      r.wbLabel,
    ],
    headings: [],
    body: '',
    boost: 0,
    snippetLanguage: locale,
    display: {
      subtitle: `${look ? `${formatLabel} (${look.code})` : formatLabel} · ${r.wbLabel}`,
      badge: look ? `CL:${look.code}` : 'PP',
      accentHex: r.accent ? accentHex(r.accent) : undefined,
    },
  }
}

/* --------------------------------------------------------------------- */
/* Products                                                               */
/* --------------------------------------------------------------------- */

export { productDoc } from './product-doc'

/* --------------------------------------------------------------------- */
/* Articles and knowledge pages                                           */
/* --------------------------------------------------------------------- */

/** The prose of a block, for the body field. Labels and captions included. */
function blockText(b: Block): string[] {
  switch (b.t) {
    case 'tldr':
      return [...b.items]
    case 'h':
      return []
    case 'p':
      return [b.text]
    case 'menu':
      return [b.old, b.new]
    case 'table':
      return [b.caption, ...b.head, ...b.rows.flat()]
    case 'callout':
      return [b.label, b.text]
    case 'compare':
      return [b.beforeLabel, b.afterLabel, b.caption]
    case 'checklist':
      return [b.label, ...b.items]
    case 'figure':
      return [b.caption, b.alt ?? '']
    case 'embed':
      return [b.caption]
  }
}

export function articleDoc(a: Article): SearchDoc {
  const tldr = a.blocks.find((b) => b.t === 'tldr')
  const topic = TOPICS.find((t) => t.id === a.topic)?.label ?? ''
  const level = LEVELS.find((l) => l.id === a.level)?.label ?? ''
  return {
    kind: a.kind,
    id: a.id,
    title: a.title,
    url: a.kind === 'knowledge' ? `/learn/${a.id}` : `/blog/${a.id}`,
    contentLanguage: ARTICLE_LANG,
    exact: [squash(a.id), squash(a.title)],
    aliases: [],
    titleText: a.title,
    /* The dek and the TL;DR are the article answering its own question in a
       sentence — a problem-shaped query ("ảnh trong nhà bị nhòe") lands here,
       and it should outrank a recipe that merely says "trong nhà". */
    summary: [a.dek, ...(tldr && tldr.t === 'tldr' ? tldr.items : [])].join(' '),
    tags: [topic, level, ...a.meta.concepts.map(conceptTitle)].filter(Boolean),
    headings: a.blocks.flatMap((b) => (b.t === 'h' ? [b.text] : [])),
    body: a.blocks.flatMap(blockText).join(' '),
    boost: 1,
    /* No subtitle: the snippet already opens with the dek, and the two lines
       would repeat each other. */
    display: {},
  }
}

/* --------------------------------------------------------------------- */
/* The generated glossary                                                 */
/* --------------------------------------------------------------------- */

/**
 * One document per glossary entry, in the reader's locale. Each is an exact
 * hit for its own name — `Color Depth`, `Color Depth R`, `Shift A/B` — which is
 * what makes a parameter question answer with a definition rather than with
 * whichever recipe happens to mention the parameter.
 */
export function glossaryDocs(locale: Locale): SearchDoc[] {
  return buildGlossary(locale).flatMap((group) => [
    /* The group itself — "Creative Look", "Picture Profile", "White Balance" —
       is a document too, landing on its heading. Without it a query naming the
       format returns eight entries that each mention it and no page about it. */
    {
      kind: 'knowledge' as const,
      id: `glossary-${group.group}`,
      title: group.title,
      url: `/learn/glossary#${group.group}`,
      contentLanguage: locale,
      exact: [squash(group.title)],
      aliases: [],
      titleText: group.title,
      summary: [
        ...group.overview,
        ...(group.looks ?? []).map((l) => `${l.code} ${l.label}`),
      ].join(' '),
      tags: group.entries.map((e) => e.label),
      headings: [],
      body: '',
      boost: 0,
      /* No subtitle where there is an overview: the snippet opens with it,
         and the first sentence would print twice — as `articleDoc` says. */
      display: {
        subtitle: group.overview.length > 0 ? undefined : snippetOf(group.entries.map((e) => e.label).join(' · ')),
      },
    },
    ...group.entries.map((e): SearchDoc => {
      const title = e.parent ? `${e.parent} · ${e.label}` : `${group.title} · ${e.label}`
      return {
        kind: 'knowledge',
        id: `glossary-${e.id}`,
        title,
        url: `/learn/glossary#${e.id}`,
        contentLanguage: locale,
        /* The label alone counts too — "V/H Balance", "Crispening" — but
           not a one-letter channel name: `R` would be an exact hit for
           every query that squashes to it. */
        exact: [
          squash(e.parent ? `${e.parent} ${e.label}` : e.label),
          squash(`${group.title} ${e.label}`),
          squash(e.label),
        ].filter((s) => s.length >= 3),
        aliases: [],
        /* Searchable title without the group name, which goes to the tags:
           otherwise "Creative Look" is a title-phrase hit on all eight of its
           adjustments, and they bury the page that explains Creative Look. */
        titleText: e.parent ? `${e.parent} ${e.label}` : e.label,
        summary: e.text,
        tags: [group.title],
        headings: [],
        body: '',
        boost: 0,
        display: { subtitle: snippetOf(e.text) },
      }
    }),
  ])
}

export function snippetFor(doc: SearchDoc): string | undefined {
  if (doc.snippetText !== undefined) return snippetOf(doc.snippetText)
  return doc.kind === 'recipe' || doc.kind === 'knowledge' ? snippetOf(doc.summary) : snippetOf(doc.summary || doc.body)
}
