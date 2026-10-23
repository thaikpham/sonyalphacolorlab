/**
 * Rewrites src/design/floor.baseline.json from the current tree.
 *
 *   npm run design:baseline
 *
 * Run this after fixing design-system violations, and read the diff: every
 * number in it should have gone DOWN. If one went up, the change added a
 * violation of one of the rules in `RULES` (a sub-13px size, a second font
 * family, a palette colour, a hex, a stroke, deleted vocabulary, scrollbar
 * CSS, an arbitrary px value or a duration of its own), and the baseline is
 * being used to launder it rather than to record progress.
 *
 * That is the whole reason the check is an exact match rather than a ceiling —
 * a ceiling lets a fix in one file silently pay for a regression in another,
 * and the total stays flat while the code gets worse in the places nobody
 * looked.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { REPO_ROOT, RULES, scanRepo, tally, totals, type Rule } from '../src/design/floor'

const BASELINE = join(REPO_ROOT, 'src/design/floor.baseline.json')

const baseline = tally(scanRepo())
const sum = totals(baseline)

writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`)

console.log(`design baseline → src/design/floor.baseline.json`)
console.log(`  files with violations : ${Object.keys(baseline).length}`)
const LABELS: Readonly<Record<Rule, string>> = {
  belowFloor: 'below 13px floor',
  mono: 'font-mono',
  palette: 'Tailwind palette',
  hex: 'hex in a component',
  stroke: 'stroke',
  deletedVocab: 'deleted vocabulary',
  scrollbarCss: 'scrollbar CSS',
  arbitraryPx: 'arbitrary [Npx]',
  duration: 'duration of its own',
}

const width = Math.max(...Object.values(LABELS).map((label) => label.length), 'files with violations'.length)
for (const rule of RULES) console.log(`  ${LABELS[rule].padEnd(width)} : ${sum[rule]}`)
console.log(`  ${'total'.padEnd(width)} : ${RULES.reduce((n, rule) => n + sum[rule], 0)}`)
