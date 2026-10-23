import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The public page's one admin affordance, pinned at the source: it must never
 * make the page dynamic, never ship an admin namespace, never probe a reader
 * who is not signed in, and render nothing but for an admin.
 */
const link = readFileSync('src/components/lab/edit-link.tsx', 'utf8')
const view = readFileSync('src/components/lab/article-view.tsx', 'utf8')

describe('EditLink', () => {
  it('asks the shared probe, told to leave signed-out readers alone', () => {
    expect(link).toMatch(/<AdminSessionProvider probeSignedOut=\{false\}>/)
    expect(link).not.toContain("fetch('/api/admin/session'")
  })

  it('renders for an admin and for nobody else', () => {
    expect(link).toMatch(/if \(gate !== 'admin'\) return null/)
  })

  it('takes its word from the server, not from a namespace', () => {
    expect(link).not.toMatch(/useTranslations\(/)
  })
})

describe('ArticleView', () => {
  it('puts Sửa on both kinds, at that kind’s edit path', () => {
    expect(view).toMatch(/<EditLink\s+href=\{`\/\$\{knowledge \? 'learn' : 'blog'\}\/\$\{article\.id\}\/edit`\}\s+label=\{t\('edit'\)\}/)
  })

  it('reads no request state, so the page stays prerendered', () => {
    expect(view).not.toMatch(/cookies\(\)|headers\(\)/)
  })
})

describe('FeedAdminRow', () => {
  const row = readFileSync('src/components/lab/feed-admin-row.tsx', 'utf8')
  const blog = readFileSync('src/app/[locale]/blog/page.tsx', 'utf8')
  const learn = readFileSync('src/app/[locale]/learn/page.tsx', 'utf8')

  it('is for an admin only and leaves a signed-out reader unprobed', () => {
    expect(row).toMatch(/<AdminSessionProvider probeSignedOut=\{false\}>/)
    expect(row).toMatch(/if \(gate !== 'admin'\) return null/)
  })

  it('reads the drafts with the session’s own headers, only once the gate is open', () => {
    expect(row).toMatch(/fetch\('\/api\/admin\/articles', \{ headers: authed\(\) \}\)/)
    expect(row).toMatch(/if \(gate !== 'admin'\) return\b/)
  })

  it('lists the drafts of its own kind, each at its edit path', () => {
    expect(row).toMatch(/a\.status === 'draft' && a\.kind === kind/)
    expect(row).toMatch(/href=\{`\$\{base\}\/\$\{a\.id\}\/edit`\}/)
  })

  it('sits on both hubs, with its words from the server', () => {
    expect(blog).toMatch(/<FeedAdminRow\s+kind="article"/)
    expect(learn).toMatch(/<FeedAdminRow\s+kind="knowledge"/)
    expect(row).not.toMatch(/useTranslations\(/)
  })

  it('hides the disclosure triangle in WebKit too, and names the drafts’ language from the one constant', () => {
    /* `list-none` removes the marker everywhere but WebKit, which draws its own
       `::-webkit-details-marker` beside the chip. */
    expect(row).toMatch(/<summary className="chip chip-action list-none \[&::-webkit-details-marker\]:hidden">/)
    expect(row).toMatch(/lang=\{ARTICLE_LANG\}/)
    expect(row).not.toMatch(/lang="vi"/)
  })
})
