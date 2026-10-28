import { validateForPublish } from '../parse'
import type { Article, ContentRefKind } from '../types'

export const PACK_NAME_RE = /^[a-z0-9-]+$/

/** What a pack may link to and which ids it may not take. Built by the caller
    from the seeds and the other page lists, so this stays pure. */
export type Known = {
  readonly takenIds: ReadonlySet<string>
  readonly refIds: Readonly<Record<ContentRefKind, ReadonlySet<string>>>
}

/** Every reason this pack cannot be pushed, `<page id>: <code>`; empty when it can. */
export function packProblems(name: string, pages: readonly Article[], known: Known): string[] {
  const problems: string[] = []
  if (!PACK_NAME_RE.test(name)) problems.push('packName')
  const seen = new Set<string>()
  for (const page of pages) {
    const at = (code: string) => problems.push(`${page.id}: ${code}`)
    for (const p of validateForPublish(page)) at(p)
    if (seen.has(page.id)) at('duplicateId')
    seen.add(page.id)
    if (known.takenIds.has(page.id)) at('idTaken')
    for (const ref of page.meta.related) {
      if (!known.refIds[ref.kind]?.has(ref.id)) at(`unknownRef ${ref.kind}:${ref.id}`)
    }
    for (const id of page.meta.prerequisites) {
      if (!known.refIds.article.has(id) && !known.refIds.knowledge.has(id)) at(`unknownPrerequisite ${id}`)
    }
    if (page.meta.sources.length === 0) at('noSource')
    if (page.meta.sources.some((s) => !s.checkedAt)) at('sourceNeedsDate')
    if (page.blocks.some((b) => b.t === 'figure')) at('figureNeedsUpload')
  }
  return problems
}
