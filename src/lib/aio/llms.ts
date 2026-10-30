import { ARTICLE_LANG } from '@/lib/lab/articles'
import type { Article } from '@/lib/lab/types'

/** The whole site as an llms.txt (llmstxt.org): a title, a summary, then one line per page. */
export type LlmsInput = {
  site: string
  knowledge: readonly Article[]
  articles: readonly Article[]
  recipes: readonly { name: string; slug: string; description: string }[]
  cameras: readonly { id: string; name: string }[]
  audio: readonly { id: string; name: string }[]
}

export const firstSentence = (s: string) => (/^.*?[.!?](?=\s|$)/.exec(s.trim())?.[0] ?? s.trim())

/** One line, whatever the stored text holds: a newline in a dek would end the item early. */
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()
const item = (name: string, url: string, note?: string) =>
  `- [${oneLine(name)}](${url})${note && oneLine(note) ? `: ${oneLine(note)}` : ''}`

export function llmsTxt(i: LlmsInput): string {
  const vi = `${i.site}/${ARTICLE_LANG}`
  /* A section with nothing published is left out whole: an empty heading reads as a broken index. */
  const section = (title: string, lines: string[]) => (lines.length ? [`## ${title}`, '', ...lines].join('\n') : '')
  return [
    '# Alpha ColorLab',
    '> Colour recipes for Sony Alpha cameras — White Balance with a Picture Profile or a Creative Look — plus a Sony camera, lens and audio catalogue and Vietnamese articles on camera settings. Recipe names and camera terms are as printed on the camera.',
    section('Learn', i.knowledge.map((p) => item(p.title, `${vi}/learn/${p.id}.md`, p.dek))),
    section('Blog', i.articles.map((p) => item(p.title, `${vi}/blog/${p.id}.md`, p.dek))),
    section('Recipes', i.recipes.map((r) => item(r.name, `${i.site}/recipe/${r.slug}`, firstSentence(r.description)))),
    section('Cameras & lenses', i.cameras.map((c) => item(c.name, `${i.site}/cameras/${c.id}`))),
    section('Audio', i.audio.map((a) => item(a.name, `${i.site}/audio/${a.id}`))),
    section('Hubs', [
      item('Recipe catalogue', `${i.site}/colorlab`),
      item('Cameras & lenses', `${i.site}/cameras`),
      item('Audio', `${i.site}/audio`),
      item('Learn', `${vi}/learn`),
      item('Glossary', `${vi}/learn/glossary`),
      item('Blog', `${vi}/blog`),
      item('Search', `${i.site}/search`),
    ]),
  ]
    .filter(Boolean)
    .join('\n\n') + '\n'
}
