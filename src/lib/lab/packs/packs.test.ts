import { describe, expect, it } from 'vitest'
import recipesSeed from '../../../../data/recipes.seed.json'
import camerasSeed from '../../../../data/sony-cameras.seed.json'
import audioSeed from '../../../../data/sony-audio.seed.json'
import { ARTICLES } from '../articles'
import { PILOT_DRAFTS } from '../pilot-drafts'
import { RESERVED_IDS } from '../parse'
import type { Article, Block } from '../types'
import { PACK_NAME_RE, packProblems, type Known } from './check'
import { PACKS } from './index'

/**
 * A pack is pages the blog-content skill wrote from an owner's document,
 * waiting to be pushed as drafts (`push:lab --pack <name>`). The gate is
 * stricter than a draft needs on purpose: a pack page must already pass the
 * publish rules, link only to things that exist, and cite a dated source, so
 * the owner's review is about the writing, not about broken plumbing.
 */
const ids = (rows: readonly { id: string }[]) => new Set(rows.map((r) => r.id))
const pages = (except?: string) => [
  ...ARTICLES,
  ...PILOT_DRAFTS,
  ...Object.entries(PACKS).flatMap(([n, p]) => (n === except ? [] : p)),
]

function knownFor(pack: string, extra: readonly Article[] = []): Known {
  const all = [...pages(), ...extra]
  return {
    takenIds: new Set([...ids(pages(pack)), ...RESERVED_IDS]),
    refIds: {
      recipe: ids(recipesSeed as { id: string }[]),
      product: new Set([...ids(camerasSeed as { id: string }[]), ...ids(audioSeed as { id: string }[])]),
      article: ids(all.filter((a) => a.kind === 'article')),
      knowledge: ids(all.filter((a) => a.kind === 'knowledge')),
    },
  }
}

describe('every pack', () => {
  /* Always one case, so the block is not empty while PACKS is (vitest fails an
     empty suite), and a pack listed under a name push:lab --pack cannot take
     fails here rather than at the command line. */
  it('is listed under a slug', () => {
    for (const name of Object.keys(PACKS)) expect(name).toMatch(PACK_NAME_RE)
  })

  for (const [name, pack] of Object.entries(PACKS)) {
    it(`${name} is ready to push`, () => {
      expect(packProblems(name, pack, knownFor(name))).toEqual([])
    })
  }
})

/* The probes: one good page, and one way to break each rule. The base is a
   live article (it passes the publish rules today) under a fresh id, with a
   dated source added. */
const source = { url: 'https://helpguide.sony.net/', title: 'Help Guide', publisher: 'Sony', checkedAt: '2026-10-28' }
const good: Article = { ...ARTICLES[0], id: 'probe-page', meta: { ...ARTICLES[0].meta, sources: [source] } }
const check = (p: readonly Article[]) => packProblems('probe', p, knownFor('probe', p))

describe('packProblems', () => {
  it('passes a page that meets every rule', () => {
    expect(check([good])).toEqual([])
  })

  it('refuses a pack name that is not a slug', () => {
    expect(packProblems('Bad Name', [good], knownFor('Bad Name', [good]))).toContain('packName')
  })

  it('carries the publish rules, prefixed with the page id', () => {
    expect(check([{ ...good, dek: '' }])).toContain('probe-page: emptyDek')
  })

  it('refuses a duplicate id within the pack and an id already taken', () => {
    expect(check([good, good])).toContain('probe-page: duplicateId')
    expect(check([{ ...good, id: ARTICLES[1].id }])).toContain(`${ARTICLES[1].id}: idTaken`)
  })

  it('refuses a reference to something that does not exist', () => {
    const bad = { ...good, meta: { ...good.meta, related: [{ kind: 'recipe' as const, id: 'PP-999' }] } }
    expect(check([bad])).toContain('probe-page: unknownRef recipe:PP-999')
    const pre = { ...good, meta: { ...good.meta, prerequisites: ['khong-co-trang-nay'] } }
    expect(check([pre])).toContain('probe-page: unknownPrerequisite khong-co-trang-nay')
  })

  it('lets a page name another page of the same pack', () => {
    const pillar: Article = { ...good, id: 'probe-pillar' }
    const cluster: Article = { ...good, meta: { ...good.meta, prerequisites: ['probe-pillar'] } }
    expect(check([pillar, cluster])).toEqual([])
  })

  it('wants at least one source, each dated', () => {
    expect(check([{ ...good, meta: { ...good.meta, sources: [] } }])).toContain('probe-page: noSource')
    const undated = { ...good, meta: { ...good.meta, sources: [{ ...source, checkedAt: undefined }] } }
    expect(check([undated])).toContain('probe-page: sourceNeedsDate')
  })

  it('refuses a figure: a picture is an upload, added from the page editor', () => {
    const figure = { t: 'figure', caption: 'x', assetId: '00000000-0000-0000-0000-000000000000' } as unknown as Block
    const blocks = [...good.blocks.slice(0, -1), figure, good.blocks[good.blocks.length - 1]]
    expect(check([{ ...good, blocks }])).toContain('probe-page: figureNeedsUpload')
  })
})
