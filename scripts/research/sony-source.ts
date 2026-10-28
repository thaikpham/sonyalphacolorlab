/**
 * A dated SourceRef for a Sony page, read now. Usage:
 *   npx tsx scripts/research/sony-source.ts <url>
 * Refuses a host that is not Sony's; exit 1 unless the page answers 200.
 */
import { isSonyHost, sourceFromHtml, todayUtc } from './lib'

async function main() {
  const url = process.argv[2]
  if (!url || !isSonyHost(url)) {
    console.error('Give one Sony URL (helpguide.sony.net, sony.com, …).')
    process.exit(1)
  }
  const res = await fetch(url, { redirect: 'follow' })
  if (res.status !== 200) {
    console.error(`${res.status} ${url}`)
    process.exit(1)
  }
  console.log(JSON.stringify(sourceFromHtml(res.url, await res.text(), todayUtc()), null, 2))
}
void main()
