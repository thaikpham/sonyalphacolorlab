/**
 * The editorial contract for Alpha Tech Blogs, encoded.
 *
 * `ARTICLE-SPEC.md` in the design handoff defines nine block types and seven
 * article archetypes, and states the rule that matters most here: content that
 * fits none of the named blocks is rewritten as a paragraph, not given a new
 * renderer. That is why `Block` is a closed discriminated union rather than an
 * open `{ type: string; props: unknown }` bag.
 *
 * `embed` is the tenth, and the spec's own rule is why it had to be added
 * rather than worked around: a video cannot be rewritten as a paragraph. The
 * rule bars a new block for content that *could* have been prose; it does not
 * bar a medium the vocabulary has no way to express. A GIF is not the tenth,
 * and after the media rework it is not anything: uploads are decoded and
 * re-encoded to three bounded WebP widths, and animation is refused by a CHECK
 * constraint on `lab_assets` rather than carried by a flag.
 *
 * The union stays closed, and the compile-time guarantee it used to carry
 * alone is now half of a pair: articles authored in this file are still checked
 * by the compiler, and articles arriving from Supabase are checked by
 * `parseBlocks` in `parse.ts` before anything renders them. A row is untrusted
 * input; the type system cannot see it, so the parser is where the same rule is
 * enforced at runtime.
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
  /* Asset UUIDs, not URLs. Both optional and independently so: the slider
     renders nothing until it has both, which is how a half-uploaded comparison
     shows as absent rather than as a broken image. */
  beforeAssetId?: string
  afterAssetId?: string
}

/** 3–6 items, each verifiable by eye on the camera. State persists. */
export type ChecklistBlock = { t: 'checklist'; label: string; items: readonly string[] }

/**
 * A still. The caption adds information; it never re-describes the picture.
 *
 * Only a still: an upload is decoded and re-encoded to three bounded WebP
 * widths, and a CHECK constraint on `lab_assets` refuses anything animated.
 * The block used to carry an `animated` flag that took a GIF around the image
 * optimizer, which meant it was served whole — a 40 MB screen recording was one
 * drag-and-drop away.
 */
export type FigureBlock = {
  t: 'figure'
  caption: string
  alt?: string
  /**
   * The asset, by UUID — never a URL.
   *
   * A stored Storage URL bakes a project reference into the article body, so
   * moving projects would mean rewriting every embedded image in every
   * article. With a UUID the article says *which* picture and the server
   * decides where it currently lives: publishing copies bytes between buckets,
   * unpublishing removes the public copy, and the body never notices.
   *
   * `animated` is gone with it. A GIF bypassed the optimizer and was served
   * whole, so a 40 MB screen recording was one drag-and-drop away; uploads are
   * re-encoded to three bounded WebP rungs now and animation is refused at the
   * schema. Re-enabling it is a deliberate migration, not a flag.
   */
  assetId?: string
}

/**
 * A video, by reference. Never a file.
 *
 * The provider and the id are stored apart rather than as a URL, and that is
 * the point of the block: a URL from an editor's address bar carries a
 * playlist, a start offset, a tracking parameter and sometimes a session, and
 * building an iframe `src` out of it hands all of that to a third party on
 * every reader's behalf. `parseEmbedUrl` in `parse.ts` reduces whatever was
 * pasted to these two fields, and the renderer builds the `src` from them, so
 * the page can only ever embed the shape this app names.
 */
export type EmbedBlock = {
  t: 'embed'
  provider: 'youtube' | 'vimeo'
  /** The bare video id — `dQw4w9WgXcQ`, `76979871`. No URL, no query string. */
  id: string
  caption: string
}

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
  | EmbedBlock

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

/**
 * Whether an article is visible to a reader.
 *
 * Two states, not three. A "scheduled" state implies a publisher that runs
 * without anyone present, and there is none — the admin publishes by pressing
 * publish. Adding the state without the runner would give an editor a date
 * field that silently does nothing.
 */
export type ArticleStatus = 'draft' | 'published'

/**
 * An article as Supabase holds it: the published shape plus the three facts
 * only the store knows.
 *
 * The reading surfaces take `Article`, never this — the feed and the article
 * view have no business branching on status, because by the time they run the
 * data layer has already filtered drafts out. Only the admin sees a record.
 */
export type ArticleRecord = Article & {
  readonly status: ArticleStatus
  /** ISO 8601, from the database. Rendered in the admin list only. */
  readonly updatedAt: string
  /** The admin's address. Never sent to a reading surface — see the anon
      column list in `data.ts` and `no-email-leak.test.ts` for the rule. */
  readonly updatedBy: string | null
}
