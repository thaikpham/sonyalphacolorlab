/**
 * Can these YouTube videos be embedded, and whose channel are they on? Usage:
 *   npx tsx scripts/research/youtube.ts <id> [id…]
 * Prints one JSON line per id; exit 1 if any cannot be embedded.
 */
import { parseOembed } from './lib'

async function main() {
  let bad = 0
  for (const id of process.argv.slice(2)) {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`
    const res = await fetch(url).catch(() => null)
    const got = res?.ok ? parseOembed(id, await res.json().catch(() => null)) : null
    if (!got) bad += 1
    console.log(JSON.stringify(got ?? { id, embeddable: false }))
  }
  process.exit(bad ? 1 : 0)
}
void main()
