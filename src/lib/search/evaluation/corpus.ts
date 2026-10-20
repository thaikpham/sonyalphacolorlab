/**
 * The offline corpus the evaluation set runs against: the same documents the
 * search service builds in seed mode, built from the same files, through the
 * same `documents.ts` builders — so a metric measured here is a metric of the
 * production ranking, not of a lookalike.
 *
 * Read straight from `data/*.seed.json` and the compiled articles rather than
 * through the data modules, which are server-only and cached. The difference
 * is plumbing; the documents are identical.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatWhiteBalance } from '@/lib/camera/format'
import type { Recipe } from '@/lib/camera/schema'
import type { SonyCamera } from '@/lib/cameras/types'
import { ARTICLES } from '@/lib/lab/articles'
import type { Article } from '@/lib/lab/types'
import {
  articleDoc,
  glossaryDocs,
  productDoc,
  recipeDoc,
  type SearchDoc,
} from '../documents'

const json = <T>(file: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), 'data', file), 'utf8')) as T

/** The `cameras` catalogue as a translator — what `getTranslations` gives the service. */
function camerasT(locale: 'en' | 'vi'): (key: string) => string {
  const messages = JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8'))
  return (key) => key.split('.').reduce((node, k) => node?.[k], messages.cameras) ?? `cameras.${key}`
}

export function seedCorpus(
  locale: 'en' | 'vi',
  extraPages: readonly Article[] = [],
): SearchDoc[] {
  const recipes = json<(Recipe & { legacyId: string | null })[]>('recipes.seed.json')
  const translations = json<{ recipeId: string; locale: string; description: string }[]>(
    'translations.seed.json',
  )
  const describe = (id: string) =>
    translations.find((t) => t.recipeId === id && t.locale === locale)?.description ??
    translations.find((t) => t.recipeId === id && t.locale === 'en')?.description ??
    ''

  const t = camerasT(locale)
  const products = [
    ...json<SonyCamera[]>('sony-cameras.seed.json'),
    ...json<SonyCamera[]>('sony-audio.seed.json'),
  ]

  return [
    ...recipes
      .filter((r) => r.published)
      .map((r) =>
        recipeDoc({
          ...r,
          look: r.format === 'cl' ? r.settings.look : undefined,
          wbLabel: formatWhiteBalance(r.whiteBalance),
          description: describe(r.id),
        }, locale),
      ),
    ...products.map((p) => productDoc(p, locale, t)),
    ...[...ARTICLES, ...extraPages].map(articleDoc),
    ...glossaryDocs(locale),
  ]
}
