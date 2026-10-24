/**
 * Fetches every Help Guide topic `evidence.ts` cites and records which of its
 * literals the live page holds — the only writer of
 * `data/camera-evidence.checks.json`.
 *
 *   npm run capabilities:check                     # fetch, check, write the file
 *   npm run capabilities:check -- --dry-run        # fetch and report, write nothing
 *   npm run capabilities:check -- --only ILCE-7M4  # one body (others keep their last check)
 *   npm run capabilities:check -- --from <dir>     # read saved pages: <dir>/<id with / as __>.html
 *
 * Behind an HTTP proxy (a cloud session, CI) Node's fetch ignores HTTPS_PROXY
 * unless started with NODE_USE_ENV_PROXY=1. A proxy that refuses the host
 * shows up as `unreachable` with its status — never as a page without the
 * literals.
 *
 * Read the diff before committing it. Each found literal carries the sentence
 * around it, and that sentence is the evidence a reviewer is approving.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { checkSource, checksFileSchema, type ChecksFile } from '../src/lib/cameras/capabilities/checks'
import { EVIDENCE_SOURCES, type EvidenceSource } from '../src/lib/cameras/capabilities/evidence'
import { normalise } from '../src/lib/cameras/capabilities/page-text'

const CHECKS_PATH = join('data', 'camera-evidence.checks.json')

type Args = { dryRun: boolean; only?: string; from?: string }

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--only') args.only = argv[++i]
    else if (a === '--from') args.from = argv[++i]
    else throw new Error(`Unknown argument: ${a}`)
  }
  return args
}

async function readPage(source: EvidenceSource, from?: string): Promise<{ html?: string; status?: number }> {
  if (from) {
    try {
      return { html: readFileSync(join(from, `${source.id.replace(/\//g, '__')}.html`), 'utf8') }
    } catch {
      return {}
    }
  }
  try {
    const res = await fetch(source.url, { headers: { 'user-agent': 'alpha-colorlab evidence check' } })
    return res.ok ? { html: await res.text(), status: res.status } : { status: res.status }
  } catch {
    return {}
  }
}

function loadChecks(): ChecksFile {
  return checksFileSchema.parse(JSON.parse(readFileSync(CHECKS_PATH, 'utf8')))
}

async function runChecks(args: Args) {
  const previous = loadChecks()
  const sources = EVIDENCE_SOURCES.filter((s) => !args.only || s.camera === args.only)
  if (sources.length === 0) throw new Error(`No evidence for ${args.only}`)

  const next: ChecksFile = { version: 1, sources: { ...previous.sources } }
  let problems = 0
  for (const source of sources) {
    const { html, status } = await readPage(source, args.from)
    const check = checkSource(source, html, status)
    next.sources[source.id] = check
    const titleOk = check.title === normalise(source.topic)
    /* Another body's guide: its topic can match word for word, and confirms nothing. */
    const modelOk = check.model === source.camera
    const presentWhereAbsent = Object.entries(check.absent).filter(([, v]) => v !== 'absent')
    const line = [
      source.id.padEnd(28),
      check.outcome.padEnd(11),
      check.outcome === 'ok'
        ? `title ${titleOk ? 'ok' : `"${check.title}"`}  model ${modelOk ? 'ok' : `"${check.model ?? '—'}"`}`
        : `status ${check.httpStatus ?? '—'}`,
      `found ${Object.keys(check.found).length}`,
      `missing ${check.missing.length}`,
      `absent ${Object.values(check.absent).filter((v) => v === 'absent').length}/${Object.keys(check.absent).length}`,
    ].join('  ')
    console.log(line)
    for (const m of check.missing) console.log(`    missing: ${m}`)
    for (const [k, v] of presentWhereAbsent) console.log(`    ${v}: ${k}`)
    if (check.outcome === 'ok' && !modelOk) {
      console.log(`    the guide is for ${check.model ?? 'no body its title names'}, not ${source.camera}`)
    }
    if (check.outcome !== 'ok' || !titleOk || !modelOk || check.missing.length || presentWhereAbsent.length) problems++
  }

  const ordered: ChecksFile = {
    version: 1,
    sources: Object.fromEntries(Object.entries(next.sources).sort(([a], [b]) => a.localeCompare(b))),
  }
  if (args.dryRun) console.log('\n  Dry run: nothing written.')
  else {
    writeFileSync(CHECKS_PATH, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8')
    console.log(`\n  Wrote ${CHECKS_PATH}. Read the diff before committing it.`)
  }
  if (problems) console.log(`  ${problems} source(s) need attention: a claim that did not match does not count.`)
}

const args = parseArgs(process.argv.slice(2))
runChecks(args).catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
