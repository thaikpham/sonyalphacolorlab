/**
 * Which project a script is about to touch, stated out loud.
 *
 * Every script in this repository used to read `NEXT_PUBLIC_SUPABASE_URL` and
 * whatever `SUPABASE_SERVICE_ROLE_KEY` happened to be in `.env.local`. With one
 * project that was merely vague. With two it is the most dangerous line in the
 * codebase: `npm run push:supabase` with the wrong file loaded writes the
 * catalogue into the project that holds Auth, and nothing about the command
 * says which one it meant.
 *
 * So there is no default and no inference. Not from the environment, not from
 * `supabase/.temp/linked-project.json`, not from which variables happen to be
 * set. A target is an argument or the script refuses to run.
 *
 * The flag vocabulary is closed for the same reason a typo should not be
 * silently ignored: `--taget content` must stop the script, not run it against
 * nothing.
 */

export type Target = 'control' | 'content';

export type Label = 'initial' | 'final-delta' | 'rollback';

export type ParsedArgs = {
  target?: Target;
  source?: Target;
  destination?: Target;
  label?: Label;
  manifest?: Label;
  dryRun: boolean;
  apply: boolean;
  rollback: boolean;
  /**
   * Lets `push:supabase` replace rows that already exist.
   *
   * Without it the push only inserts what is missing. Once the admin editors
   * write to the content project, the database is the source of truth and the
   * seed is a Git-time snapshot of it — a push that replaced existing rows put
   * that snapshot back over every edit made since, and reported success.
   */
  overwrite: boolean;
  /**
   * Lets `push:lab` also insert the pilot pages from `pilot-drafts.ts`, as
   * drafts. Off by default so the script still does exactly what it did.
   */
  withPilotDrafts: boolean;
};

export class ArgumentError extends Error {
  readonly code = 'invalidArguments';
}

const TARGETS = new Set<Target>(['control', 'content']);
const LABELS = new Set<Label>(['initial', 'final-delta', 'rollback']);

const VALUE_FLAGS = new Map<string, keyof ParsedArgs>([
  ['--target', 'target'],
  ['--source', 'source'],
  ['--destination', 'destination'],
  ['--label', 'label'],
  ['--manifest', 'manifest'],
]);

const BOOLEAN_FLAGS = new Map<string, keyof ParsedArgs>([
  ['--dry-run', 'dryRun'],
  ['--apply', 'apply'],
  ['--rollback', 'rollback'],
  ['--overwrite', 'overwrite'],
  ['--with-pilot-drafts', 'withPilotDrafts'],
]);

function readTarget(flag: string, raw: string | undefined): Target {
  if (!raw || !TARGETS.has(raw as Target)) {
    throw new ArgumentError(`${flag} must be "control" or "content".`);
  }
  return raw as Target;
}

function readLabel(flag: string, raw: string | undefined): Label {
  if (!raw || !LABELS.has(raw as Label)) {
    throw new ArgumentError(`${flag} must be one of: ${[...LABELS].join(', ')}.`);
  }
  return raw as Label;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    dryRun: false,
    apply: false,
    rollback: false,
    overwrite: false,
    withPilotDrafts: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];

    const booleanKey = BOOLEAN_FLAGS.get(flag);
    if (booleanKey) {
      (parsed[booleanKey] as boolean) = true;
      continue;
    }

    const valueKey = VALUE_FLAGS.get(flag);
    if (!valueKey) throw new ArgumentError(`Unknown argument: ${flag}`);

    const value = argv[i + 1];
    i += 1;
    const read =
      valueKey === 'label' || valueKey === 'manifest'
        ? readLabel(flag, value)
        : readTarget(flag, value);
    /* A command copied and edited can end up naming two projects. Last-wins
       would quietly run it against whichever came second — a guess, which is
       exactly what this module exists to refuse. */
    if (parsed[valueKey] !== undefined && parsed[valueKey] !== read) {
      throw new ArgumentError(`${flag} is given twice, as ${String(parsed[valueKey])} and ${read}.`);
    }
    (parsed[valueKey] as string) = read;
  }

  /* `--dry-run --apply` is not a contradiction the script can resolve by
     picking one. Whichever it picked would be a surprise, and one of the two
     surprises writes to a database. */
  if (parsed.dryRun && parsed.apply) {
    throw new ArgumentError('--dry-run and --apply are mutually exclusive.');
  }

  if (parsed.source && parsed.destination && parsed.source === parsed.destination) {
    throw new ArgumentError('--source and --destination must name different projects.');
  }

  /* Writing content back into the control project is the documented emergency
     rollback and nothing else. Without the explicit flag it is overwhelmingly
     likely to be a mistake — the shape of a command that has been copied from
     the wrong runbook section. */
  if (parsed.destination === 'control' && !parsed.rollback) {
    throw new ArgumentError(
      '--destination control is the emergency rollback path and requires --rollback.',
    );
  }

  return parsed;
}

/**
 * Refuses a flag the vocabulary knows but this script does not implement.
 *
 * The vocabulary is shared by every script, so "known" is not "honoured":
 * `push:supabase --overwrite --dry-run` passed the parse and ran the full
 * overwrite, because nothing in push-supabase reads `dryRun`. Each script
 * names the flags it acts on, and anything else stops it.
 */
function refuseUnimplemented(
  argv: readonly string[],
  required: readonly string[],
  allow: readonly string[],
): void {
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (VALUE_FLAGS.has(flag)) i += 1;
    if (!required.includes(flag) && !allow.includes(flag)) {
      throw new ArgumentError(`${flag} is not supported by this script.`);
    }
  }
}

/** For a script whose whole job is one project. `allow` lists every other flag it implements. */
export function requireTarget(
  argv: readonly string[],
  allow: readonly string[] = [],
): { args: ParsedArgs; target: Target } {
  const args = parseArgs(argv);
  refuseUnimplemented(argv, ['--target'], allow);
  if (!args.target) {
    throw new ArgumentError('--target control|content is required. There is no default.');
  }
  return { args, target: args.target };
}

/** For a script that moves rows from one project to another. */
export function requireTransfer(
  argv: readonly string[],
  allow: readonly string[] = [],
): { args: ParsedArgs; source: Target; destination: Target } {
  const args = parseArgs(argv);
  refuseUnimplemented(argv, ['--source', '--destination'], allow);
  if (!args.source || !args.destination) {
    throw new ArgumentError('--source and --destination are both required.');
  }
  return { args, source: args.source, destination: args.destination };
}
