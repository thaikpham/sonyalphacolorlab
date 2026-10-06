/**
 * A product as a search document — its own module so the Sony Wiki grid can
 * rank on the client with exactly the rules the header and `/search` use,
 * without pulling the article catalogue and the glossary into its bundle.
 * See `documents.ts` for the other kinds.
 */

import { modelCode, productAliases } from '@/lib/cameras/aliases'
import { productTitle } from '@/lib/content/relations'
import type { SearchDoc } from './documents'
import { squash } from './text'

export type ProductForSearch = {
  readonly id: string
  readonly sku: string
  readonly name: string
  readonly fullName: string
  readonly category: string
  readonly subCategory1: string
  readonly subCategory2: string
  readonly priceFormatted: string
  readonly imageUrl: string
  /** `featureList()` output for both locales, flattened. */
  readonly featureText: readonly string[]
}

export function productDoc(p: ProductForSearch): SearchDoc {
  const code = modelCode(p.sku)
  return {
    kind: 'product',
    id: p.id,
    title: productTitle(p),
    url: p.category === 'audio' ? `/audio/${p.id}` : `/cameras/${p.id}`,
    contentLanguage: 'en',
    exact: [squash(p.id), squash(code), squash(productTitle(p))].filter(Boolean),
    aliases: productAliases(p),
    titleText: `${productTitle(p)} ${p.name}`,
    summary: p.featureText.join(' · '),
    tags: [p.category, p.subCategory1, p.subCategory2].filter(Boolean),
    headings: [],
    body: '',
    boost: 0,
    display: {
      subtitle: [code, p.subCategory1 || p.category, p.subCategory2].filter(Boolean).join(' · '),
      badge: p.subCategory1 || p.category,
      imageUrl: p.imageUrl || undefined,
      price: p.priceFormatted || undefined,
    },
  }
}
