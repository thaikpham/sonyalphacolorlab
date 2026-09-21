import Image from 'next/image'
import { assetUrl } from '@/lib/lab/media'
import { headingId } from '@/lib/lab/outline'
import type {
  CalloutBlock,
  EmbedBlock,
  FigureBlock,
  HeadingBlock,
  MenuBlock,
  ParagraphBlock,
  TableBlock,
  TldrBlock,
} from '@/lib/lab/types'

/**
 * The eight static block renderers. `compare` and `checklist` are interactive
 * and live in their own client modules, so an article that uses neither ships
 * no JavaScript for its body at all — `embed` is static too: an iframe is the
 * provider's player, and nothing on this side has to run to place one.
 *
 * The handoff's spec is a light theme and separates almost everything with
 * `border-top: 1px solid var(--seam)`. This ecosystem bans strokes (rule 4) —
 * depth is translucency, blur, shadow and the specular highlight — so every
 * divider here is a `.seam`, the gradient rule that fades out at both ends,
 * and every surface is one of the four elevation wholes. The measurements the
 * handoff does own (radii, padding, the type steps, the 44px floor) are kept
 * exactly.
 */

/** Every block sits in the same 28px rhythm. One place to change it. */
export const BLOCK_GAP = 'mb-7'

export function TldrCard({ block }: { block: TldrBlock }) {
  return (
    /* The one tinted accent field in the article. Rule 5 applies in full:
       body copy is pure white, its label is step 300 of the same ramp — never
       an ink step, which on this fill is the "dark type on a dark field" bug
       the system was rebuilt to remove. */
    <aside className={`${BLOCK_GAP} rounded-lg bg-accent-900 px-6 py-[22px] shadow-[var(--elevation-spec)]`}>
      <p className="label text-accent-300">TL;DR</p>
      <ul className="mt-2">
        {block.items.map((item) => (
          <li key={item} className="flex gap-2.5 py-1">
            <span aria-hidden className="text-accent-300">
              —
            </span>
            <span className="text-body text-white">{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export function Heading({ block, index }: { block: HeadingBlock; index: number }) {
  return (
    /* `scroll-margin-top` so a jump from the rail does not park the heading
       under the viewport's top edge. */
    <h2
      id={headingId(index)}
      className={`${BLOCK_GAP} mt-3 scroll-mt-6 text-title-2 font-extrabold tracking-[-0.02em] leading-[1.2] text-ink`}
    >
      {block.text}
    </h2>
  )
}

export function Paragraph({ block }: { block: ParagraphBlock }) {
  return (
    <p className={`${BLOCK_GAP} text-body text-ink-muted [text-wrap:pretty]`}>{block.text}</p>
  )
}

/**
 * The old/new menu pair, always both.
 *
 * The card labels name the bodies rather than the menu generations, because
 * "Menu cũ" alone does not tell a ZV-E10 owner which of the two is theirs.
 * `break-words` because a path is a single unbroken run of `→` separators and
 * would otherwise push the card past the column on a phone.
 *
 * The generation names arrive translated from the server parent rather than
 * through `getTranslations` here: two client modules import `BLOCK_GAP` from
 * this file, so it cannot reach for a server-only API. The body names are
 * product names and stay literal.
 */
export type MenuPairLabels = { readonly old: string; readonly new: string }

export function MenuPair({ block, labels }: { block: MenuBlock; labels: MenuPairLabels }) {
  const cards = [
    { label: `${labels.old} · a6400 · ZV-E10`, path: block.old },
    { label: `${labels.new} · a6700 · ZV-E10 II`, path: block.new },
  ]

  return (
    <div className={`${BLOCK_GAP} flex flex-wrap gap-3`}>
      {cards.map((c) => (
        <div key={c.label} className="surface-sunken flex-1 basis-60 px-4 py-3.5">
          <p className="label">{c.label}</p>
          <p className="mt-1 text-body-sm leading-relaxed break-words text-ink">{c.path}</p>
        </div>
      ))}
    </div>
  )
}

/**
 * Three columns, always. A real `<table>` rather than the handoff's flex rows:
 * the content is tabular, and a screen reader announcing "column 2, PT" is the
 * difference between a comparison a blind reader can follow and three
 * unlabelled runs of text.
 *
 * The horizontal scroll container is the sanctioned exception to "the page
 * body never scrolls sideways" — at 320px three columns of Vietnamese cannot
 * fit, and shrinking the type is not available below the 13px floor.
 */
export function ComparisonTable({ block }: { block: TableBlock }) {
  return (
    <figure className={BLOCK_GAP}>
      <div className="surface scroll-area overflow-x-auto rounded-md">
        <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-sunken">
              {block.head.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`label px-4 py-3 ${i === 0 ? 'w-[38%]' : 'w-[31%]'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              /* Alternate rows tint instead of ruling. A hairline grid on a
                 dark ground reads as noise — `.row-tint` is the system's
                 answer and the reason there is no divider token for a table. */
              <tr key={row[0]} className={r % 2 === 1 ? 'row-tint' : undefined}>
                <th scope="row" className="px-4 py-3 text-body-sm font-semibold text-ink">
                  {row[0]}
                </th>
                <td className="px-4 py-3 text-body-sm text-ink-muted">{row[1]}</td>
                <td className="px-4 py-3 text-body-sm text-ink-muted">{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* The caption states the measuring conditions; ARTICLE-SPEC makes it
          mandatory precisely so a table cannot imply more than it measured. */}
      <figcaption className="meta mt-2">{block.caption}</figcaption>
    </figure>
  )
}

/** An exception or a boundary condition. Its label is the condition itself. */
export function Callout({ block }: { block: CalloutBlock }) {
  return (
    <aside className={`${BLOCK_GAP} surface-raised px-[22px] py-5`}>
      <p className="label text-accent-400">{block.label}</p>
      <p className="mt-1.5 text-body text-ink [text-wrap:pretty]">{block.text}</p>
    </aside>
  )
}

/**
 * A figure renders only when its image exists, caption included.
 *
 * Neither half of the block stands on its own: an empty 16:9 well in production
 * reads as a broken page rather than as "image pending", and a caption alone is
 * a line of text pointing at nothing, which is worse. Attach an asset and the
 * whole block appears; nothing else has to change.
 *
 * The `src` names the widest rung; the project's custom loader swaps the width
 * segment for whichever of the three actually fits, so no optimizer is involved
 * on either side. The variants were produced at upload from the original bytes,
 * so re-encoding them through `/_next/image` would pay a transformation to make
 * an already optimal file slightly worse.
 */
export function ArticleFigure({ block, articleId }: { block: FigureBlock; articleId: string }) {
  if (!block.assetId) return null
  const src = assetUrl(articleId, block.assetId)
  if (!src) return null

  return (
    <figure className={BLOCK_GAP}>
      <div className="surface-sunken relative aspect-video overflow-hidden rounded-lg">
        <Image
          src={src}
          alt={block.alt ?? ''}
          fill
          sizes="(max-width: 48rem) 100vw, 40rem"
          className="object-cover"
        />
      </div>
      <figcaption className="meta mt-2">{block.caption}</figcaption>
    </figure>
  )
}

/**
 * A video, as the provider's own player.
 *
 * The `src` is built from the two stored fields and never from anything an
 * editor pasted — see `parseEmbedUrl` in `parse.ts` for why a URL is reduced to
 * a provider and an id before it is stored. Both hosts here are the
 * privacy-preserving variants the providers publish: `youtube-nocookie.com`,
 * and Vimeo with `dnt=1`. Neither stops the embed being a third party on the
 * page, but both stop it profiling a reader who never pressed play.
 *
 * `loading="lazy"` matters more than usual: a player iframe is several hundred
 * kilobytes of someone else's JavaScript, and an article may carry two.
 */
export function ArticleEmbed({ block }: { block: EmbedBlock }) {
  const src =
    block.provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${block.id}?rel=0`
      : `https://player.vimeo.com/video/${block.id}?dnt=1`

  return (
    <figure className={BLOCK_GAP}>
      {/* The well is `surface-sunken` rather than transparent so the block has
          the same weight as a figure while the player is still loading — an
          iframe paints nothing for its first few hundred milliseconds, and a
          hole in the article is what that looks like without a ground. */}
      <div className="surface-sunken relative aspect-video overflow-hidden rounded-lg">
        <iframe
          src={src}
          title={block.caption}
          loading="lazy"
          /* `allowFullScreen` and nothing else. The default `allow` list hands
             a third-party frame autoplay, camera, microphone and payment on
             this origin's behalf; naming the three the player genuinely needs
             is the difference between embedding a video and delegating the
             page. */
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <figcaption className="meta mt-2">{block.caption}</figcaption>
    </figure>
  )
}
