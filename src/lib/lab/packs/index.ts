import type { Article } from '../types'

/**
 * Content packs: pages the blog-content skill (`.claude/skills/colorlab-blog-content`)
 * wrote from one of the owner's documents. One file per pack, `<name>.ts`,
 * exporting its `Article[]`, listed here. `push:lab --pack <name>` inserts a
 * pack's pages as drafts and never overwrites a row; `packs.test.ts` is the
 * gate every pack passes before it can be merged.
 */
export const PACKS: Readonly<Record<string, readonly Article[]>> = {}
