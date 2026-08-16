/**
 * Rewrites src/design/floor.baseline.json from the current tree.
 *
 *   npm run design:baseline
 *
 * Run this after fixing design-system violations, and read the diff: every
 * number in it should have gone DOWN. If one went up, the change added a
 * sub-13px size, a second font family or a Tailwind palette colour, and the
 * baseline is being used to launder it rather than to record progress.
 *
 * That is the whole reason the check is an exact match rather than a ceiling —
 * a ceiling lets a fix in one file silently pay for a regression in another,
 * and the total stays flat while the code gets worse in the places nobody
 * looked.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { REPO_ROOT, scanRepo, tally, totals } from '../src/design/floor'

const BASELINE = join(REPO_ROOT, 'src/design/floor.baseline.json')

const baseline = tally(scanRepo())
const sum = totals(baseline)

writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`)

console.log(`design baseline → src/design/floor.baseline.json`)
console.log(`  files with violations : ${Object.keys(baseline).length}`)
console.log(`  below 13px floor      : ${sum.belowFloor}`)
console.log(`  font-mono             : ${sum.mono}`)
console.log(`  Tailwind palette      : ${sum.palette}`)
console.log(`  total                 : ${sum.belowFloor + sum.mono + sum.palette}`)
