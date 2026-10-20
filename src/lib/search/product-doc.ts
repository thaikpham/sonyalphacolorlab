/**
 * A product as a search document — its own module so the Sony Wiki grid can
 * rank on the client with exactly the rules the header and `/search` use,
 * without pulling the article catalogue and the glossary into its bundle.
 * See `documents.ts` for the other kinds.
 */

import type { Locale } from '@/lib/camera/explanations'
import { modelCode, productAliases } from '@/lib/cameras/aliases'
import { priceLabel, subCategoryLabel } from '@/lib/cameras/display'
import { splitFeatures, type LocalizedFeatures } from '@/lib/cameras/features'
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
  readonly priceVnd: number
  readonly priceFormatted: string
  readonly imageUrl: string
  readonly features: LocalizedFeatures | null | undefined
}

/** A translator scoped to the `cameras` namespace, as `display.ts` takes it. */
type CamerasT = (key: string) => string

/**
 * Both locales' bullets are searchable — a reader on `/en` who types a
 * Vietnamese phrase still finds the product — but the snippet is the reader's
 * own, chosen the way `featureList()` chooses it, and says which language it
 * fell back to. The display strings are stored catalogue values, so they go
 * through the same labels the grid and the product page use: the seed stores
 * "Tai nghe" and, for a product with no published figure, "Liên hệ".
 */
export function productDoc(p: ProductForSearch, locale: Locale, t: CamerasT): SearchDoc {
  const code = modelCode(p.sku)
  const { en, vi } = splitFeatures(p.features)
  /* `featureList()`'s choice: the reader's list, else the other one. */
  const snippetLanguage = locale === 'vi' ? (vi.length > 0 ? 'vi' : 'en') : en.length > 0 ? 'en' : 'vi'
  const sub1 = subCategoryLabel(p.subCategory1, t)
  const sub2 = subCategoryLabel(p.subCategory2, t)
  return {
    kind: 'product',
    id: p.id,
    title: productTitle(p),
    url: p.category === 'audio' ? `/audio/${p.id}` : `/cameras/${p.id}`,
    contentLanguage: 'en',
    exact: [squash(p.id), squash(code), squash(productTitle(p))].filter(Boolean),
    aliases: productAliases(p),
    titleText: `${productTitle(p)} ${p.name}`,
    summary: [...en, ...vi].join(' · '),
    tags: [p.category, p.subCategory1, p.subCategory2].filter(Boolean),
    headings: [],
    body: '',
    boost: 0,
    snippetText: (snippetLanguage === 'vi' ? vi : en).join(' · '),
    snippetLanguage,
    display: {
      subtitle: [code, sub1 || p.category, sub2].filter(Boolean).join(' · '),
      badge: sub1 || p.category,
      imageUrl: p.imageUrl || undefined,
      price: p.priceFormatted ? priceLabel(p, t) : undefined,
    },
  }
}
