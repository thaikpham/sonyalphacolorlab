import { describe, expect, it } from 'vitest';

import { ArgumentError, parseArgs, requireTarget, requireTransfer } from './args';

/**
 * The most dangerous line in the repository is a script that guesses.
 *
 * With one project, reading `NEXT_PUBLIC_SUPABASE_URL` out of whatever
 * `.env.local` was loaded was merely vague. With two, `npm run push:supabase`
 * against the wrong file writes the catalogue into the project that holds Auth
 * — and nothing in the command, the output, or the exit code says which one it
 * meant until somebody notices a table where it should not be.
 *
 * So these tests are mostly refusals. A typo must stop the script rather than
 * be ignored; an ambiguous combination must stop it rather than be resolved by
 * a rule nobody remembers.
 */

describe('parseArgs', () => {
  it('reads an explicit target', () => {
    expect(parseArgs(['--target', 'content']).target).toBe('content');
  });

  it('reads a transfer', () => {
    const args = parseArgs(['--source', 'control', '--destination', 'content']);
    expect(args).toMatchObject({ source: 'control', destination: 'content' });
  });

  /* Each switch must land on its own key and nowhere else. "Some value came
     out true" passed with `--dry-run` and `--apply` swapped — and a swap makes
     the preview the one that writes. */
  it.each([
    ['--dry-run', 'dryRun'],
    ['--apply', 'apply'],
    ['--rollback', 'rollback'],
    ['--overwrite', 'overwrite'],
    ['--with-pilot-drafts', 'withPilotDrafts'],
  ] as const)('reads %s into %s and nothing else', (flag, key) => {
    expect(parseArgs([flag])).toEqual({ ...parseArgs([]), [key]: true });
  });

  /* Accepted and then read by nothing: `content:verify --expect-empty` ran the
     ordinary manifest comparison and reported it as the emptiness check. */
  it.each(['--expect-empty', '--expect-baseline', '--since-manifest'])(
    'does not accept %s, which no script implements',
    (flag) => {
      expect(() => parseArgs([flag])).toThrow(`Unknown argument: ${flag}`);
    },
  );

  it('rejects a value flag stated twice with different values', () => {
    /* An edited copy of a command: last-wins would run it against control. */
    expect(() => parseArgs(['--target', 'content', '--manifest', 'initial', '--target', 'control'])).toThrow(
      ArgumentError,
    );
    expect(parseArgs(['--target', 'content', '--target', 'content']).target).toBe('content');
  });

  it.each(['initial', 'final-delta', 'rollback'])('accepts the %s label', (label) => {
    expect(parseArgs(['--label', label]).label).toBe(label);
  });

  it('defaults every switch to off, so nothing happens by accident', () => {
    expect(parseArgs([])).toEqual({
      dryRun: false,
      apply: false,
      rollback: false,
      /* `push:supabase` inserts missing rows only unless told to replace:
         the database holds the admin's edits and the seed does not. */
      overwrite: false,
      /* `push:lab` adds the pilot pages — as drafts — only when asked. */
      withPilotDrafts: false,
    });
  });

  it.each([
    ['an unknown switch', ['--taget', 'content']],
    ['a target that is neither project', ['--target', 'production']],
    ['a target with no value', ['--target']],
    ['an unsupported label', ['--label', 'whatever']],
    ['an unsupported manifest', ['--manifest', 'yesterday']],
  ])('rejects %s', (_label, argv) => {
    expect(() => parseArgs(argv)).toThrow(ArgumentError);
  });

  it('reads --pack as a slug, once', () => {
    expect(parseArgs(['--target', 'content', '--pack', 'iso-co-ban']).pack).toBe('iso-co-ban');
    expect(() => parseArgs(['--pack', 'Not A Slug'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--pack'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--pack', 'a', '--pack', 'b'])).toThrow(ArgumentError);
  });

  it('rejects --dry-run with --apply', () => {
    /* Not a contradiction a script can resolve by picking one: whichever it
       picked would be a surprise, and one of the two surprises writes. */
    expect(() => parseArgs(['--dry-run', '--apply'])).toThrow(ArgumentError);
  });

  it('rejects a transfer from a project to itself', () => {
    expect(() => parseArgs(['--source', 'content', '--destination', 'content'])).toThrow(
      ArgumentError,
    );
  });

  it('rejects writing into control without the rollback flag', () => {
    /* Importing content into the control project is the documented emergency
       path and nothing else. Without the flag it is almost certainly a command
       copied from the wrong section of the runbook. */
    expect(() => parseArgs(['--source', 'content', '--destination', 'control'])).toThrow(
      ArgumentError,
    );
    expect(
      parseArgs(['--source', 'content', '--destination', 'control', '--rollback']).destination,
    ).toBe('control');
  });
});

describe('requireTarget', () => {
  it('refuses to guess', () => {
    expect(() => requireTarget([])).toThrow(/no default/i);
  });

  it('passes an explicit one through', () => {
    expect(requireTarget(['--target', 'control']).target).toBe('control');
  });

  /* The vocabulary is shared, so a script has to say which part of it it
     implements. `push:supabase --overwrite --dry-run` used to pass the check
     and run the full overwrite: push-supabase never reads `dryRun`. */
  it('refuses a known flag the script does not implement', () => {
    expect(() => requireTarget(['--target', 'content', '--dry-run'], ['--overwrite'])).toThrow(
      /--dry-run/,
    );
    expect(() => requireTarget(['--target', 'content', '--manifest', 'initial'])).toThrow(
      ArgumentError,
    );
  });

  it('passes the flags the script does implement', () => {
    const { args } = requireTarget(['--target', 'content', '--overwrite'], ['--overwrite']);
    expect(args.overwrite).toBe(true);
  });

  /* `--pack` takes a value, so its value must not be read as a flag the
     script does not implement. */
  it('passes --pack and its value to a script that implements it', () => {
    const { args } = requireTarget(['--target', 'content', '--pack', 'iso-co-ban', '--dry-run'], ['--pack', '--dry-run']);
    expect(args.pack).toBe('iso-co-ban');
    expect(() => requireTarget(['--target', 'content', '--pack', 'iso-co-ban'])).toThrow(/--pack/);
  });
});

describe('requireTransfer', () => {
  it('needs both ends named', () => {
    expect(() => requireTransfer(['--source', 'control'])).toThrow(ArgumentError);
  });

  it('refuses a known flag the script does not implement', () => {
    expect(() =>
      requireTransfer(['--source', 'control', '--destination', 'content', '--overwrite'], ['--apply']),
    ).toThrow(/--overwrite/);
  });

  it('passes a complete transfer through', () => {
    expect(requireTransfer(['--source', 'control', '--destination', 'content'])).toMatchObject({
      source: 'control',
      destination: 'content',
    });
  });
});
