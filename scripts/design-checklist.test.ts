import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { problems } from '../.github/scripts/design-checklist.mjs'

/**
 * The checklist a PR carries (`.github/pull_request_template.md`, section
 * "## Thiết kế") is a merge condition: every box ticked, or the first one,
 * "Không đổi giao diện". The parser is thirty lines; this is what keeps a
 * reworded template and the parser in step.
 */
const template = readFileSync('.github/pull_request_template.md', 'utf8')
const tick = (body: string) => body.replace(/- \[ \]/g, '- [x]')

describe('the design checklist', () => {
  it('refuses the template as shipped (nothing ticked)', () => {
    expect(problems(template).length).toBeGreaterThan(0)
  })

  it('accepts every box ticked', () => {
    expect(problems(tick(template))).toEqual([])
  })

  it('accepts "Không đổi giao diện" alone', () => {
    const body = template.replace('- [ ] Không đổi giao diện', '- [x] Không đổi giao diện')
    expect(problems(body)).toEqual([])
  })

  it('names each box left unticked', () => {
    const body = tick(template).replace('- [x] Ba trạng thái', '- [ ] Ba trạng thái')
    expect(problems(body)).toEqual([expect.stringContaining('Ba trạng thái')])
  })

  it('reads an English heading too', () => {
    const body = tick(template).replace('## Thiết kế', '## Design')
    expect(problems(body)).toEqual([])
  })

  it('asks for the section when it is missing', () => {
    expect(problems('## Thay đổi\n\nx')).toEqual([expect.stringContaining('Thiết kế')])
  })

  it('ignores the HTML comments the template carries', () => {
    expect(problems(tick(template).replace('<!--', '<!-- - [ ] fake '))).toEqual([])
  })
})
