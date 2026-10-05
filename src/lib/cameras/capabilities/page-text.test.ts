import { describe, expect, it } from 'vitest'
import { findLiteral, helpGuideText, normalise, section } from './page-text'

/**
 * A page shaped like a Help Guide topic. Synthetic on purpose — a fixture for
 * the reader, not a copy of Sony's text: the sidebar repeats a menu name that
 * the topic does not contain, which is the trap the topic-only read avoids.
 */
const PAGE = `
<html><head><title>Ignored - Sony</title></head><body>
<nav id="menu"><ul><li>Fixture Look (still image/movie)</li><li>Sidebar Only Item</li></ul></nav>
<main role="main" id="main">
  <h2 id="id_title"> <span class="uicontrol">Fixture Look</span> (still image/movie)</h2>
  <div id="id_content">
    <p>MENU → (Exposure/Color) → [Color/Tone] → [
      <span>Fixture Look</span>] .</p>
    <dl><dt>AB(Alpha Beta)</dt><dd>:</dd><dd>First option.</dd>
        <dt>AB2(Alpha Beta 2)</dt><dd>: Second &amp; last option.</dd></dl>
    <p>Options: One / Two / Three:</p>
    <p>Value ITU709: curve. 709: tone.</p>
  </div>
  <div id="questionnaire">Was this helpful? Sidebar Only Item</div>
</main></body></html>`

describe('helpGuideText', () => {
  const page = helpGuideText(PAGE)

  it('reads the topic heading and body, not the head or the sidebar', () => {
    expect(page?.title).toBe('Fixture Look (still image/movie)')
    expect(page?.body).toContain('[Color/Tone] → [Fixture Look]')
    expect(page?.body).not.toContain('Sidebar Only Item')
    expect(page?.body).not.toContain('Ignored')
  })

  it('decodes entities and rejoins text the markup split', () => {
    expect(page?.body).toContain('AB(Alpha Beta): First option.')
    expect(page?.body).toContain('AB2(Alpha Beta 2): Second & last option.')
  })

  it('is null for a page that is not a topic', () => {
    expect(helpGuideText('<html><body><p>No topic here</p></body></html>')).toBeNull()
  })
})

describe('normalise', () => {
  it('drops the space inside brackets and before punctuation, and collapses the rest', () => {
    expect(normalise('[ Creative Look]  ,\n ST(Standard)\n:')).toBe('[Creative Look], ST(Standard):')
  })
})

describe('findLiteral', () => {
  const body = helpGuideText(PAGE)!.body

  it('finds a literal as a whole, not inside a longer token', () => {
    expect(findLiteral(body, 'AB(Alpha Beta):')).not.toBeNull()
    expect(findLiteral(body, 'AB2(Alpha Beta 2):')).not.toBeNull()
    /* `709:` occurs inside `ITU709:` first; only the standalone one counts. */
    const hit = findLiteral(body, '709: tone')
    expect(hit?.context).toContain('709: tone')
    expect(findLiteral('Value ITU709: curve.', '709:')).toBeNull()
  })

  it('normalises the literal the same way as the page', () => {
    expect(findLiteral(body, '[ Color/Tone ] → [ Fixture Look ]')).not.toBeNull()
  })

  it('returns a short excerpt for the reviewer', () => {
    const hit = findLiteral(body, 'Second & last option.')
    expect(hit?.context.length).toBeLessThan(160)
  })
})

describe('section', () => {
  const body = helpGuideText(PAGE)!.body

  it('is the text strictly between two literals', () => {
    expect(section(body, 'Options:', 'Value ITU709')?.trim()).toBe('One / Two / Three:')
  })

  it('is null when either end is missing — never an empty list', () => {
    expect(section(body, 'Options:', 'Not on the page')).toBeNull()
    expect(section(body, 'Not on the page', 'Value')).toBeNull()
  })
})
