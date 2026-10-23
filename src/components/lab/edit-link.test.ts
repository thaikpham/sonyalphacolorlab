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
