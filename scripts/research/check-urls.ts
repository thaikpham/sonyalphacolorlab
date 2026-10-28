/**
 * Every link a page cites must answer 200. Usage:
 *   npx tsx scripts/research/check-urls.ts https://a … | or one per line on stdin
 * Exit 1 if any does not.
 */
import { readUrls } from './lib'

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

async function main() {
  const input = process.argv.length > 2 ? process.argv.slice(2).join('\n') : await new Response(process.stdin as unknown as ReadableStream).text()
  let bad = 0
  for (const url of readUrls(input)) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA } })
      const moved = res.url !== url ? ` → ${res.url}` : ''
      if (res.status !== 200) bad += 1
      console.log(`${res.status} ${url}${moved}`)
    } catch (e) {
      bad += 1
      console.log(`ERR ${url} ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  process.exit(bad ? 1 : 0)
}
void main()
