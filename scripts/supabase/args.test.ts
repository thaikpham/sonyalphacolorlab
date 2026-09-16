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

  it.each(['--expect-empty', '--expect-baseline', '--dry-run', '--apply', '--rollback'])(
    'reads %s',
    (flag) => {
      expect(Object.values(parseArgs([flag])).some((v) => v === true)).toBe(true);
    },
  );

  it.each(['initial', 'final-delta', 'rollback'])('accepts the %s label', (label) => {
    expect(parseArgs(['--label', label]).label).toBe(label);
  });

  it('defaults every switch to off, so nothing happens by accident', () => {
    expect(parseArgs([])).toEqual({
      expectEmpty: false,
      expectBaseline: false,
      dryRun: false,
      apply: false,
      rollback: false,
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
});

describe('requireTransfer', () => {
  it('needs both ends named', () => {
    expect(() => requireTransfer(['--source', 'control'])).toThrow(ArgumentError);
  });

  it('passes a complete transfer through', () => {
    expect(requireTransfer(['--source', 'control', '--destination', 'content'])).toMatchObject({
      source: 'control',
      destination: 'content',
    });
  });
});
