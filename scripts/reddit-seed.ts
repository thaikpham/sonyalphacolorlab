/**
 * Posts the project's own "start here" topic for one product.
 *
 * This is the second write path, and the only one that uses the bot token: the
 * post carries the project's account because the project wrote it. A reader's
 * topic never comes through here — the drawer hands them to Reddit's own
 * compose page so their name goes on their words (`config.ts`, `submitUrl`).
 *
 *   npm run reddit:seed -- sony-ilce-7m4-bq-ap2          # print, post nothing
 *   npm run reddit:seed -- sony-ilce-7m4-bq-ap2 --post   # actually submit
 *
 * Dry by default. A subreddit post is public and awkward to unpublish, so the
 * flag is the confirmation.
 *
 * Every value in the body is read from `data/sony-cameras.seed.json` — Rule 1
 * applies to a Reddit post exactly as it applies to a component. A spec the
 * catalogue does not carry is left out, never filled in from memory.
 *
 * The npm script passes `--conditions=react-server`, which resolves the
 * `server-only` marker in `reddit/client.ts` to its empty stub. Without it that
 * package throws on import and this script cannot run outside Next at all —
 * `npx tsx scripts/reddit-seed.ts` on its own will fail.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { submitSelfPost } from '../src/lib/reddit/client';
import { SUBREDDIT_HANDLE } from '../src/lib/reddit/config';
import { composeBody, composeTitle, productUrl } from '../src/lib/reddit/topics';
import type { SonyCamera } from '../src/lib/cameras/types';

const [productId, ...flags] = process.argv.slice(2);
const shouldPost = flags.includes('--post');

if (!productId) {
  console.error('Usage: npm run reddit:seed -- <product-id> [--post]');
  process.exit(1);
}

const catalogue = JSON.parse(
  readFileSync(join(process.cwd(), 'data', 'sony-cameras.seed.json'), 'utf8'),
) as SonyCamera[];

const product = catalogue.find((p) => p.id === productId);
if (!product) {
  console.error(`No product with id "${productId}" in data/sony-cameras.seed.json.`);
  process.exit(1);
}

/* Labels come from the message catalogue, not from the field names. Rule 3 puts
   every user-visible string there, and a Reddit post is as user-visible as the
   spec table — `- **effectivePixels**: 33 MP` is a variable name on screen. */
const specLabels = (
  JSON.parse(readFileSync(join(process.cwd(), 'messages', 'en.json'), 'utf8')) as {
    cameras: { specs: Record<string, string> };
  }
).cameras.specs;

const specLines = product.specs
  ? Object.entries(product.specs)
      .filter(
        ([key, value]) =>
          typeof value === 'string' && value && key !== 'kind' && key !== 'specsSource',
      )
      .map(([key, value]) => `- **${specLabels[key] ?? key}**: ${value}`)
  : [];

const body = [
  `Discussion space for the **${product.fullName}** — ${SUBREDDIT_HANDLE}.`,
  '',
  'Share White Balance Shift recipes, Picture Profile settings, sample frames and setup questions.',
  'Bạn có thể viết bằng tiếng Việt hoặc tiếng Anh.',
  '',
  `SKU **${product.sku}** · ${product.priceFormatted}`,
  '',
  ...(specLines.length ? ['Specs as the catalogue publishes them:', '', ...specLines, ''] : []),
  /* Named as a limit rather than left implied: the spec table shows "not
     published" for a reason, and a thread that guesses those rows back in is
     the failure this project spends a whole rule avoiding. */
  'Where a spec reads "not published", Sony genuinely does not state it — please do not fill it in from memory.',
  ...(product.specs?.specsSource ? ['', `Source: ${product.specs.specsSource}`] : []),
].join('\n');

const title = composeTitle(`Start here — ${product.fullName}`, 'guide');
const text = composeBody(body, product);

console.log(`\n── would post to ${SUBREDDIT_HANDLE} ──\n`);
console.log(title);
console.log('');
console.log(text);
console.log('\n───────────────────────────────\n');

if (!shouldPost) {
  console.log('Dry run. Re-run with --post to submit it.');
  process.exit(0);
}

/* The footer link is what binds every future reply to this product, and it is
   baked into the post at submit time — a post carrying a localhost URL binds to
   nothing anyone else can open, and editing it later is a manual job. */
if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(productUrl(product.id))) {
  console.error(
    `✗ NEXT_PUBLIC_SITE_URL points at localhost, so the post would link to ${productUrl(product.id)}.`,
  );
  console.error('  Set it to the deployed origin before posting.');
  process.exit(1);
}

submitSelfPost(title, text)
  .then(({ url }) => console.log(`Posted: ${url}`))
  .catch((e: unknown) => {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
