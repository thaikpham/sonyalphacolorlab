import 'server-only'
import { getSonyAudio } from '@/lib/audio/data'
import { getSonyCameras } from '@/lib/cameras/data'
import { unknownRefs } from '@/lib/content/relations'
import { listRecipeRecords } from '@/lib/recipes/admin-store'
import { listArticleRecords } from './admin-store'
import type { ArticleMeta, ContentRef } from './types'

/**
 * Which of an article's references point at nothing at all.
 *
 * Asked against the *admin* stores for recipes and pages, drafts included —
 * a link to a recipe or article still being written is legitimate and starts
 * rendering the moment its target is published. What is refused is an id that
 * does not exist anywhere, which is a typo the reader would otherwise never
 * see: the related section quietly renders one link fewer.
 *
 * `null` means the check could not be made. The route decides what that means
 * — a draft saves anyway, a publish is refused, because "we could not verify
 * the links" is not the same as "the links are fine".
 */
export async function findUnknownReferences(
  meta: Pick<ArticleMeta, 'related' | 'prerequisites'>,
): Promise<ContentRef[] | null> {
  if (meta.related.length === 0 && meta.prerequisites.length === 0) return []

  try {
    const needsRecipes = meta.related.some((r) => r.kind === 'recipe')
    const needsProducts = meta.related.some((r) => r.kind === 'product')

    const [recipes, cameras, audio, pages] = await Promise.all([
      needsRecipes ? listRecipeRecords() : Promise.resolve([]),
      needsProducts ? getSonyCameras() : Promise.resolve([]),
      needsProducts ? getSonyAudio() : Promise.resolve([]),
      listArticleRecords(),
    ])

    return unknownRefs(meta, {
      recipes: new Set(recipes.map((r) => r.recipe.id)),
      products: new Set([...cameras, ...audio].map((p) => p.id)),
      pages: new Map(pages.map((p) => [p.id, p.kind])),
    })
  } catch (err) {
    console.error('[lab] reference check failed:', err instanceof Error ? err.message : err)
    return null
  }
}
