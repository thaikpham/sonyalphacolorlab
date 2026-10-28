import { ARTICLES } from '../../src/lib/lab/articles'
import { PACKS } from '../../src/lib/lab/packs'
import { PILOT_DRAFTS } from '../../src/lib/lab/pilot-drafts'
import type { Article } from '../../src/lib/lab/types'

export type LabCandidate = { article: Article; status: 'published' | 'draft' }

/**
 * What `push:lab` may insert. The three live articles go in published (a draft
 * would take them off the site); pilot drafts and a pack's pages go in as
 * drafts, always — the owner publishes each from its own editor.
 */
export function labCandidates(
  opts: { withPilotDrafts: boolean; pack?: string },
  packs: Readonly<Record<string, readonly Article[]>> = PACKS,
): LabCandidate[] {
  const out: LabCandidate[] = ARTICLES.map((article) => ({ article, status: 'published' }))
  if (opts.withPilotDrafts) out.push(...PILOT_DRAFTS.map((article) => ({ article, status: 'draft' as const })))
  if (opts.pack !== undefined) {
    const pack = packs[opts.pack]
    if (!pack) {
      throw new Error(`Unknown pack "${opts.pack}". Packs: ${Object.keys(packs).join(', ') || '(none yet)'}`)
    }
    out.push(...pack.map((article) => ({ article, status: 'draft' as const })))
  }
  return out
}
