/**
 * Pulls the product catalogue back out of Supabase into
 * `data/sony-cameras.seed.json` and `data/sony-audio.seed.json`.
 *
 * Supabase is the source of truth once the admin UI is in use, but the seed is
 * what the test suite reads and what the app falls back to with no credentials
 * — AGENTS.md requires the build to work offline. Without this, an admin edit
 * lives only in the database and `specs.test.ts` keeps asserting against a file
 * that is quietly months out of date.
 *
 *   npm run pull:supabase -- --target content         # write the files
 *   npm run pull:supabase -- --target content --dry   # print what would change, touch nothing
 *                                                       (--dry-run is the same)
 *
 * Every column the admin editor writes comes back — names, image, gallery,
 * features, specs and highlights, and a cleared highlights column clears the seed
 * too. It used to bring only features and specs, so a renamed
 * product or a corrected gallery stayed in the database alone, and the next
 * `push:supabase --overwrite` put the seed's old copy back over it.
 *
 * Run it before committing after an editing session. It is deliberately not
 * automatic: overwriting a tracked data file is a thing you should ask for.
 */
import { adminClient } from './lib/db';
import { mergePulled, readPullArgs, type Row } from './lib/catalogue-pull';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEED_CAMERAS = join(process.cwd(), 'data', 'sony-cameras.seed.json');
const SEED_AUDIO = join(process.cwd(), 'data', 'sony-audio.seed.json');

async function main() {
  /* `sony_cameras` lives in the content project. There is no generic "the
     project" left to default to, and pulling the catalogue out of the wrong one
     would overwrite the seed files with whatever that project happened to hold. */
  const { target, dry } = readPullArgs(process.argv.slice(2));
  if (target !== 'content') {
    throw new Error('The catalogue lives in the content project. Pass --target content.');
  }
  const db = adminClient(target);
  const { data, error } = await db
    .from('sony_cameras')
    .select(
      'id, sku, name, full_name, category, sub_category_1, sub_category_2, price_vnd, price_formatted, url, image_url, gallery_urls, features, specs, highlights, updated_at, updated_by',
    );

  if (error) {
    console.error('Read failed:', error.message);
    process.exit(1);
  }
  if (!data?.length) {
    console.error('The table is empty. Refusing to overwrite the seed with nothing.');
    process.exit(1);
  }

  const cameraSeed = JSON.parse(readFileSync(SEED_CAMERAS, 'utf8')) as Row[];
  const audioSeed = JSON.parse(readFileSync(SEED_AUDIO, 'utf8')) as Row[];

  const { changed, edits } = mergePulled(data as Row[], [...cameraSeed, ...audioSeed]);
  const cameraChanged = cameraSeed.filter((p) => changed.has(p)).length;
  const audioChanged = audioSeed.filter((p) => changed.has(p)).length;

  for (const line of edits) console.log(line);

  const totalChanged = cameraChanged + audioChanged;
  if (totalChanged === 0) {
    console.log('Seeds already match Supabase. Nothing to write.');
    return;
  }
  if (dry) {
    console.log(`\n${totalChanged} product(s) would change. Re-run without --dry to write.`);
    return;
  }

  if (cameraChanged > 0) {
    writeFileSync(SEED_CAMERAS, `${JSON.stringify(cameraSeed, null, 2)}\n`, 'utf8');
    console.log(`Wrote changes to data/sony-cameras.seed.json.`);
  }
  if (audioChanged > 0) {
    writeFileSync(SEED_AUDIO, `${JSON.stringify(audioSeed, null, 2)}\n`, 'utf8');
    console.log(`Wrote changes to data/sony-audio.seed.json.`);
  }
  console.log('Run `npm run verify` before committing — the suite reads these files.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
