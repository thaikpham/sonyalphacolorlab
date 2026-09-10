/**
 * The editorial contract for Alpha Tech Blogs, encoded.
 *
 * `ARTICLE-SPEC.md` in the design handoff defines nine block types and seven
 * article archetypes, and states the rule that matters most here: there is no
 * tenth block. Content that fits none of the nine is rewritten as a paragraph,
 * not given a new renderer. That is why `Block` is a closed discriminated
 * union rather than an open `{ type: string; props: unknown }` bag — a draft
 * carrying a block this file does not name should fail to compile, which is
 * the only place that rule can actually be enforced.
 *
 * Article bodies are Vietnamese and stay Vietnamese in both locales. They are
 * authored prose, the same category as a recipe name or a Creative Look code:
 * camera menu items keep the English printed on the camera (`Creative Look`,
 * `AF w/ Shutter`), the explanation around them is Vietnamese. Only the UI
 * chrome — filter labels, button text, the empty state — lives in
 * `messages/*.json`.
 */

/** The ten topics, plus the synthetic `all` the filter adds. */
export type TopicId =
  | 'setup'
  | 'color'
  | 'af'
  | 'exposure'
  | 'lens'
  | 'body'
  | 'video'
  | 'post'
  | 'gear'
  | 'firmware'

export type LevelId = 'newbie' | 'mid' | 'pro'

/** The seven archetypes from ARTICLE-SPEC §2. Carried for editorial audit. */
export type Archetype =
  | 'setup-guide'
  | 'versus'
  | 'technique'
  | 'explainer'
  | 'fix'
  | 'gear'
  | 'recipe'

/**
 * Exactly three lines, each a decision or an action. The tuple is deliberate:
 * the spec says "đúng 3 gạch đầu dòng" and a `string[]` would let a fourth
 * through review. It is also what lets the right rail's summary card render
 * three rows without a length check.
 */
export type TldrBlock = { t: 'tldr'; items: readonly [string, string, string] }

/** A heading is a sentence with a verb, never a noun label. Carries the anchor. */
export type HeadingBlock = { t: 'h'; text: string }

export type ParagraphBlock = { t: 'p'; text: string }

/**
 * Always a pair. Sony split the menu tree in two — a6400/ZV-E10 kept the old
 * `Camera Settings1/2` tabs, a6700/ZV-E10 II moved to the `Exposure/Color`,
 * `Focus`, `Setup` grouping — and a path given for only one of them sends
 * half the readership hunting.
 */
export type MenuBlock = { t: 'menu'; old: string; new: string }

/** Three columns, 3–6 rows, and a caption stating the measuring conditions. */
export type TableBlock = {
  t: 'table'
  head: readonly [string, string, string]
  rows: readonly (readonly [string, string, string])[]
  caption: string
}

/** `label` is the condition it applies under ("Nếu bạn chụp RAW"), not "Lưu ý". */
export type CalloutBlock = { t: 'callout'; label: string; text: string }

/**
 * The labels carry real parameter values ("1/30, ISO 400"), never
 * "Before"/"After" — the point of the slider is that the reader can read the
 * settings off the two halves.
 *
 * `before`/`after` are optional because no photography shipped with the
 * handoff. Absent, the block renders its wells empty rather than a broken
 * image; the slider still works so the layout can be reviewed.
 */
export type CompareBlock = {
  t: 'compare'
  beforeLabel: string
  afterLabel: string
  caption: string
  before?: string
  after?: string
}

/** 3–6 items, each verifiable by eye on the camera. State persists. */
export type ChecklistBlock = { t: 'checklist'; label: string; items: readonly string[] }

/** The caption adds information; it never re-describes the picture. */
export type FigureBlock = { t: 'figure'; caption: string; alt?: string; src?: string }

export type Block =
  | TldrBlock
  | HeadingBlock
  | ParagraphBlock
  | MenuBlock
  | TableBlock
  | CalloutBlock
  | CompareBlock
  | ChecklistBlock
  | FigureBlock

export type Article = {
  /** Stable, URL-safe. This is the `/blog/<id>` segment and the storage key. */
  readonly id: string
  readonly topic: TopicId
  readonly level: LevelId
  readonly archetype: Archetype
  /** Authored, not computed — "6 phút đọc". */
  readonly read: string
  readonly title: string
  /** 1–2 sentences, ≤ 220 characters. Falls back to the summary card. */
  readonly dek: string
  readonly blocks: readonly Block[]
}

/**
 * Which camera generation's menu tree to show. The two names are the two
 * trees, not two products: every a6400-era body reads `old`, every
 * a6700-era body reads `new`.
 */
export type MenuVersion = 'old' | 'new'
