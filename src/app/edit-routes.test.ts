import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The edit routes, pinned at the source: request-time, never indexed, never in
 * the sitemap, the paper room, and their own message provider so no admin
 * string rides on a reader's page.
 */
const read = (p: string) => readFileSync(p, 'utf8')
const ROUTES = [
  ['src/app/[locale]/blog/[id]/edit/page.tsx', "kind=\"article\" id={id}"],
  ['src/app/[locale]/learn/[id]/edit/page.tsx', "kind=\"knowledge\" id={id}"],
  ['src/app/[locale]/blog/new/page.tsx', 'kind="article" id={null}'],
  ['src/app/[locale]/learn/new/page.tsx', 'kind="knowledge" id={null}'],
] as const

describe.each(ROUTES)('%s', (path, call) => {
  const src = read(path)

  it('renders per request and is never indexed', () => {
    expect(src).toMatch(/export const dynamic = 'force-dynamic'/)
    expect(src).toMatch(/robots: \{ index: false, follow: false \}/)
  })

  it('is the paper room for the browser chrome', () => {
    expect(src).toMatch(/themeColor: '#F9F8F5', colorScheme: 'light'/)
  })

  it('opens the editor on the right kind', () => {
    expect(src).toContain(`<EditRoute ${call} />`)
  })
})

describe('EditRoute', () => {
  const src = read('src/app/[locale]/_edit/edit-route.tsx')

  it('paints the paper room under the site header', () => {
    expect(src).toMatch(/className="theme-paper contents"/)
    expect(src).toMatch(/<Suspense>\s*<SiteHeader \/>\s*<\/Suspense>/)
  })

  it('sends the gate’s and the editor’s namespaces, and nothing a reader page needs', () => {
    expect(src).toMatch(/const clientMessages = \{\n\s+adminUi: messages\.adminUi,\n\s+labAdmin: messages\.labAdmin,\n {2}\}/)
  })

  it('keeps the header outside the provider, which replaces the layout’s messages', () => {
    expect(src.indexOf('<SiteHeader')).toBeLessThan(src.indexOf('<NextIntlClientProvider'))
  })

  it('leaves the one main landmark to the gate, whose own screens bring theirs', () => {
    /* The route wrapper was a `main` around a gate whose panels, sign-in form
       and step-up form each render a `main` of their own: two landmarks, and
       the gutter paid twice. */
    expect(src).not.toMatch(/<main/)
    expect(src).toMatch(/<div className="mx-auto min-h-screen-dynamic w-full max-w-\[86rem\] inset-safe pt-8 pb-24">/)
    const gate = read('src/components/lab/editor/edit-gate.tsx')
    expect(gate).toMatch(/<main>\s*<ArticleEditor id=\{id\} kind=\{kind\} \/>\s*<\/main>/)
  })
})

describe('the public tree', () => {
  it('never lists an edit route in the sitemap', () => {
    expect(read('src/app/sitemap.ts')).not.toMatch(/\/edit|\/new/)
  })

  it('ships no admin namespace from the public layout', () => {
    const layout = read('src/app/[locale]/layout.tsx')
    expect(layout).not.toMatch(/adminUi:|labAdmin:/)
  })
})

describe('/admin/blog', () => {
  it('sends the editor to the feed, where the pages and the drafts are', () => {
    const src = read('src/app/admin/blog/page.tsx')
    expect(src).toMatch(/redirect\('\/blog'\)/)
    expect(src).toMatch(/export const dynamic = 'force-dynamic'/)
  })
})
