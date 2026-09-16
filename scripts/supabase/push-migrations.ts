/**
 * Apply one migration root to one project, and say which before it does.
 *
 *   npm run supabase:migrations -- --target content            # prints the plan
 *   npm run supabase:migrations -- --target content --apply    # runs it
 *
 * There are two roots now and they are not interchangeable:
 *
 *   control -> supabase/migrations          the applied history, plus corrections
 *   content -> supabase/content/migrations  the new baseline, from zero
 *
 * `supabase db push` takes its target from `supabase/config.toml` and a linked
 * project file, both of which are ambient state — the second one,
 * `supabase/.temp/linked-project.json`, is a file nobody remembers writing and
 * everybody inherits. Pushing the content baseline into the project that holds
 * Auth because of a stale temp file is a recoverable mistake only in the sense
 * that a restore exists.
 *
 * So this copies the chosen root into a throwaway directory with a config
 * containing exactly one thing — the resolved ref — and passes that ref on the
 * command line as well. Nothing is read from the repository's own Supabase
 * state.
 *
 * Credentials travel in the child environment, never in `argv`: a
 * `--db-password` on a command line is visible to every process on the machine
 * and lands in shell history.
 */

import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ArgumentError, requireTarget, type Target } from './args';
import { projectRef } from './clients';

const ROOTS: Record<Target, string> = {
  control: join('supabase', 'migrations'),
  content: join('supabase', 'content', 'migrations'),
};

async function main() {
  const { args, target } = requireTarget(process.argv.slice(2));
  const root = ROOTS[target];
  const ref = projectRef(target);

  const files = (await readdir(root)).filter((f) => f.endsWith('.sql')).sort();

  console.log(`\n  target        ${target}`);
  console.log(`  root          ${root}`);
  console.log(`  project ref   ${ref}`);
  console.log(`  migrations    ${files.length}`);
  for (const file of files) console.log(`                ${file}`);

  if (!args.apply) {
    console.log('\n  Nothing was applied. Re-run with --apply.\n');
    return;
  }

  /* A directory the CLI can only interpret one way: the chosen root, shaped as
     `supabase/migrations`, beside a config naming one project and nothing else. */
  const work = await mkdtemp(join(tmpdir(), 'colorlab-migrations-'));
  await mkdir(join(work, 'supabase', 'migrations'), { recursive: true });
  await cp(root, join(work, 'supabase', 'migrations'), { recursive: true });
  await writeFile(join(work, 'supabase', 'config.toml'), `project_id = "${ref}"\n`, 'utf8');

  console.log(`\n  applying to ${ref}...\n`);

  const result = spawnSync(
    'npx',
    ['--no-install', 'supabase', 'db', 'push', '--project-ref', ref, '--workdir', work],
    { stdio: 'inherit', env: process.env },
  );

  if (result.status !== 0) {
    console.error('\n  db push failed.\n');
    process.exit(result.status ?? 1);
  }
  console.log('\n  OK applied.\n');
}

main().catch((error) => {
  console.error(error instanceof ArgumentError ? `\n  ${error.message}\n` : error);
  process.exit(1);
});
