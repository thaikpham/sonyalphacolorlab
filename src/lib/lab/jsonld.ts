import { conceptTitle } from '@/lib/content/concepts'
import { conceptAnchor } from '@/lib/learn/glossary'
import { ARTICLE_LANG } from './articles'
import { plainText } from './markdown'
import type { Article, Block } from './types'

/** Question headings each answered by the paragraph right after them — the page's own words. */
export function faqPairs(blocks: readonly Block[]): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = []
  blocks.forEach((b, i) => {
    const next = blocks[i + 1]
    if (b.t === 'h' && b.text.trim().endsWith('?') && next?.t === 'p') out.push({ question: b.text.trim(), answer: next.text })
  })
  return out
}

/**
 * The JSON-LD nodes for one article or knowledge page. See the header of
 * `structured-data.tsx` for what is deliberately not declared (no
 * `datePublished`; the reviewed date stays on the page).
 */
export function articleJsonLd(article: Article, opts: { site: string; path: string; learnTitle: string }): Record<string, unknown>[] {
  const { site } = opts
  const url = `${site}${opts.path}`
  const vi = `${site}/${ARTICLE_LANG}`
  const knowledge = article.kind === 'knowledge'
  /* `learnTitle` comes in the body's language (the component translates it);
     `Alpha Tech Blogs` is a product name and is the same in both. */
  const parent = knowledge ? { name: opts.learnTitle, item: `${vi}/learn` } : { name: 'Alpha Tech Blogs', item: `${vi}/blog` }
  const concepts = article.meta.concepts
  const words = article.blocks.map(plainText).join(' ').split(/\s+/).filter(Boolean).length
  const faq = faqPairs(article.blocks)

  const nodes: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': knowledge ? 'TechArticle' : 'BlogPosting',
      headline: article.title,
      ...(article.dek ? { description: article.dek } : {}),
      url,
      mainEntityOfPage: url,
      inLanguage: ARTICLE_LANG,
      ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
      ...(article.meta.authorName ? { author: { '@type': 'Person', name: article.meta.authorName } } : {}),
      publisher: { '@type': 'Organization', name: 'Alpha ColorLab', url: site, logo: `${site}/icon` },
      ...(concepts.length
        ? {
            keywords: concepts.map(conceptTitle).join(', '),
            about: concepts.map((k) => ({
              '@type': 'DefinedTerm',
              name: conceptTitle(k),
              url: `${vi}/learn/glossary#${conceptAnchor(k)}`,
              inDefinedTermSet: `${vi}/learn/glossary`,
            })),
          }
        : {}),
      wordCount: words,
      ...(article.meta.sources.length > 0
        ? {
            citation: article.meta.sources.map((s) => ({
              '@type': 'CreativeWork',
              name: s.title,
              url: s.url,
              ...(s.publisher ? { publisher: { '@type': 'Organization', name: s.publisher } } : {}),
            })),
          }
        : {}),
      isPartOf: { '@type': 'WebSite', name: 'Alpha ColorLab', url: site },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: parent.name, item: parent.item },
        { '@type': 'ListItem', position: 2, name: article.title, item: url },
      ],
    },
  ]
  if (faq.length) {
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
    })
  }
  return nodes
}
