import 'server-only'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { hasContentConfig } from '@/lib/supabase/server'
import { ARTICLES } from './articles'
import { parseBlocks } from './parse'
import type { ArticleRecord } from './types'

/**
 * A file-backed article store, for local development with no Supabase.
 *
 * This is the missing half of an affordance the codebase already had:
 * `requireAdmin()` hands out a super-admin session when Supabase is
 * unconfigured and `NODE_ENV` is `development`, so the gate already opens
 * offline — but every admin route then answered `notConfigured`, because there
 * was nowhere to put an article. The editor was reachable and inert.
 *
 * It is also what makes the feature developable at all without a cloud
 * dependency, which is worth more than the outage that prompted it: the whole
 * write path — create, edit, publish, delete, upload — can be exercised on a
 * laptop on a plane.
 *
 * **This can never run in production.** `isDevStore()` requires *both* that
 * Supabase is absent and that `NODE_ENV` is `development`, which is the same
 * pair `requireAdmin()` demands before it invents an admin — anything weaker
 * here would be a filesystem-backed CMS that a deployment could fall into when
 * an environment variable went missing, holding articles nobody could see and
 * losing them on the next deploy. Every exported function below asserts it
 * again rather than trusting its caller.
 */

/** Local scratch, not a seed: it is written by the editor and is gitignored. */
const FILE = join(process.cwd(), 'data', 'lab-articles.dev.json')

/**
 * The one definition of "the local store is in play".
 *
 * Both halves are load-bearing. Without the `development` check a production
 * deploy that lost its Supabase keys would silently start writing articles to
 * a container filesystem; without the `hasContentConfig()` check a
 * developer with real credentials would edit a local file and wonder why
 * nothing reached the site.
 */
export function isDevStore(): boolean {
  return !hasContentConfig() && process.env.NODE_ENV === 'development'
}

function assertDev() {
  if (!isDevStore()) {
    throw new Error('The development article store is not available here.')
  }
}

/**
 * Read the file, falling back to the authored catalogue the first time.
 *
 * Seeding from `ARTICLES` rather than starting empty is the point: a developer
 * opening the editor for the first time gets three real articles to edit,
 * which is a far better test of the screen than three blank ones they have to
 * type first. They are marked `published` because that is what they are on the
 * live site.
 */
function readAll(): ArticleRecord[] {
  assertDev()
  let raw: string
  try {
    raw = readFileSync(FILE, 'utf8')
  } catch {
    return ARTICLES.map((a) => ({
      ...a,
      status: 'published' as const,
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    }))
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    /* Parsed, not cast, for the same reason a Supabase row is: this file is
       written by an editor and hand-editable, so it is untrusted input with a
       shorter path to a renderer than the database has. */
    return parsed.flatMap((row) => {
      if (typeof row !== 'object' || row === null) return []
      const r = row as Record<string, unknown>
      if (typeof r.id !== 'string' || typeof r.title !== 'string') return []
      return [
        {
          ...(r as unknown as ArticleRecord),
          blocks: parseBlocks(r.blocks).blocks,
        },
      ]
    })
  } catch {
    return []
  }
}

function writeAll(records: readonly ArticleRecord[]) {
  assertDev()
  mkdirSync(dirname(FILE), { recursive: true })
  writeFileSync(FILE, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
}

export function devList(): ArticleRecord[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function devPublished(): ArticleRecord[] {
  return devList().filter((a) => a.status === 'published')
}

export function devGet(id: string): ArticleRecord | null {
  return readAll().find((a) => a.id === id) ?? null
}

export function devHasId(id: string): boolean {
  return readAll().some((a) => a.id === id)
}

export function devUpsert(record: ArticleRecord): void {
  const all = readAll()
  const i = all.findIndex((a) => a.id === record.id)
  if (i === -1) all.push(record)
  else all[i] = record
  writeAll(all)
}

export function devDelete(id: string): boolean {
  const all = readAll()
  const next = all.filter((a) => a.id !== id)
  if (next.length === all.length) return false
  writeAll(next)
  return true
}
