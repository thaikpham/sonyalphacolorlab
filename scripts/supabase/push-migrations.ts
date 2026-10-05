/**
 * Apply one migration root to one project, and say which before it does.
 *
 *   npm run supabase:migrations -- --target content             # lists the root's files
 *   npm run supabase:migrations -- --target content --dry-run   # asks the project what would run
 *   npm run supabase:migrations -- --target content --apply     # runs it
 *
 * There are two roots now and they are not interchangeable:
 *
 *   control -> supabase/migrations          the applied history, plus corrections
 *   content -> supabase/content/migrations  the content plane, reconciled by 0004
 *
 * The listing is the local files only. Only `--dry-run` and `--apply` compare
 * them with the project's recorded history, and the CLI compares version
 * prefixes alone: a recorded `0003` counts as this root's 0003 whatever its name.
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
 * The CLI is `supabase` on PATH; `npm run` puts `node_modules/.bin` first. It
 * reads the database password from `SUPABASE_DB_PASSWORD` and prompts without
 * it, so the target's own `*_SUPABASE_DB_PASSWORD` is passed under that name and
 * any inherited `SUPABASE_DB_PASSWORD` is dropped: one left over from the other
 * project would be tried against this one.
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

const PASSWORDS: Record<Target, string> = {
  control: 'CONTROL_SUPABASE_DB_PASSWORD',
  content: 'CONTENT_SUPABASE_DB_PASSWORD',
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

  if (!args.apply && !args.dryRun) {
    console.log('\n  Nothing was applied. --dry-run asks the project what would run; --apply runs it.\n');
    return;
  }

  /* A directory the CLI can only interpret one way: the chosen root, shaped as
     `supabase/migrations`, beside a config naming one project and nothing else. */
  const work = await mkdtemp(join(tmpdir(), 'colorlab-migrations-'));
  await mkdir(join(work, 'supabase', 'migrations'), { recursive: true });
  await cp(root, join(work, 'supabase', 'migrations'), { recursive: true });
  await writeFile(join(work, 'supabase', 'config.toml'), `project_id = "${ref}"\n`, 'utf8');

  const env = { ...process.env };
  delete env.SUPABASE_DB_PASSWORD;
  const password = process.env[PASSWORDS[target]];
  if (password) env.SUPABASE_DB_PASSWORD = password;
  else console.log(`\n  ${PASSWORDS[target]} is not set; the CLI will ask for the password.`);

  console.log(`\n  ${args.dryRun ? 'asking' : 'applying to'} ${ref}...\n`);

  const result = spawnSync(
    'supabase',
    ['db', 'push', '--project-ref', ref, '--workdir', work, ...(args.dryRun ? ['--dry-run'] : [])],
    { stdio: 'inherit', env },
  );

  if (result.error) {
    console.error(`\n  Could not start the Supabase CLI: ${result.error.message}`);
    console.error('  Install it (https://supabase.com/docs/guides/cli) so `supabase` is on PATH.\n');
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('\n  db push failed.\n');
    process.exit(result.status ?? 1);
  }
  console.log(args.dryRun ? '\n  OK, nothing was applied.\n' : '\n  OK applied.\n');
}

main().catch((error) => {
  console.error(error instanceof ArgumentError ? `\n  ${error.message}\n` : error);
  process.exit(1);
});
