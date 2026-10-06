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
import { splitFeatures } from '@/lib/cameras/features'
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
        }),
      ),
    ...products.map((p) => {
      const { en, vi } = splitFeatures(p.features)
      return productDoc({ ...p, featureText: [...en, ...vi] })
    }),
    ...[...ARTICLES, ...extraPages].map(articleDoc),
    ...glossaryDocs(locale),
  ]
}
