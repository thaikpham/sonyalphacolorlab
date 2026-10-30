import type { Article, Block } from './types'

/**
 * An article as Markdown, for the `.md` twin an AI agent reads instead of the
 * HTML (`/vi/blog/<id>.md`, `/vi/learn/<id>.md`). Every block type is
 * handled by the switch below; a new one fails to compile here first.
 */

/** A line that would start a Markdown construct is escaped (`1. ` becomes `1\. `: a backslash before a digit is not an escape). */
const line = (s: string) =>
  s.replace(/^(\s*)([#>\-+*])/, '$1\\$2').replace(/^(\s*\d+)([.)])/, '$1\\$2')
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

function blockMarkdown(b: Block): string {
  switch (b.t) {
    case 'tldr':
      return b.items.map((i) => `> ${i}`).join('\n')
    case 'h':
      return `## ${b.text}`
    case 'p':
      return line(b.text)
    case 'menu':
      return `- Cũ: ${b.old}\n- Mới: ${b.new}`
    case 'table':
      return [
        `| ${b.head.map(cell).join(' | ')} |`,
        `| ${b.head.map(() => '---').join(' | ')} |`,
        ...b.rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
        ...(b.caption ? ['', `*${b.caption}*`] : []),
      ].join('\n')
    case 'callout':
      return `> **${b.label}** ${b.text}`
    case 'compare':
      return `*So sánh ảnh: ${b.beforeLabel} / ${b.afterLabel} — ${b.caption}*`
    case 'checklist':
      return `**${b.label}**\n\n${b.items.map((i) => `- [ ] ${i}`).join('\n')}`
    case 'figure':
      return `*Hình: ${b.caption}*`
    case 'embed':
      return `[${b.caption}](${b.provider === 'youtube' ? `https://www.youtube.com/watch?v=${b.id}` : `https://vimeo.com/${b.id}`})`
    default: {
      const never: never = b
      return never
    }
  }
}

/** The words a reader sees in one block — for `wordCount`. */
export function plainText(b: Block): string {
  switch (b.t) {
    case 'tldr':
      return b.items.join(' ')
    case 'h':
    case 'p':
      return b.text
    case 'menu':
      return `${b.old} ${b.new}`
    case 'table':
      return [...b.head, ...b.rows.flat(), b.caption].join(' ')
    case 'callout':
      return `${b.label} ${b.text}`
    case 'compare':
      return `${b.beforeLabel} ${b.afterLabel} ${b.caption}`
    case 'checklist':
      return [b.label, ...b.items].join(' ')
    case 'figure':
    case 'embed':
      return b.caption
    default: {
      const never: never = b
      return never
    }
  }
}

export function articleMarkdown(article: Article, opts: { canonicalUrl: string }): string {
  const head = [`# ${article.title}`, line(article.dek), `Nguồn gốc: ${opts.canonicalUrl}`]
  const body = article.blocks.map(blockMarkdown)
  const sources = article.meta.sources.length
    ? [
        '## Nguồn',
        article.meta.sources
          .map((s) => `- [${s.title}](${s.url})${[s.publisher, s.checkedAt].filter(Boolean).length ? ` — ${[s.publisher, s.checkedAt].filter(Boolean).join(', ')}` : ''}`)
          .join('\n'),
      ]
    : []
  return [...head, ...body, ...sources].filter((s) => s !== '').join('\n\n') + '\n'
}
