import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The recipe editor's wiring, read from its source.
 *
 * What an answer does to the draft is executed in `recipe-draft.test.ts`; this
 * file pins that the component goes through those functions, and the guards
 * around them. Source assertions because the suite has no DOM — the same call
 * `admin-editor.test.ts` makes for the product editor.
 */

const PATH = 'src/components/colorlab/admin/recipe-admin.tsx';
const source = readFileSync(PATH, 'utf8');

/** The source with comments removed, so prose never reads as code. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\{\s*\}/g, '');

/** One handler's body, from its declaration to the next top-level `const`. */
const handler = (name: string) => {
  const start = code.indexOf(`const ${name} = `);
  expect(start, name).toBeGreaterThan(-1);
  const end = code.indexOf('\n  const ', start + 1);
  return code.slice(start, end === -1 ? undefined : end);
};

const messages = {
  en: JSON.parse(readFileSync('messages/en.json', 'utf8')).recipeAdmin as Record<string, string>,
  vi: JSON.parse(readFileSync('messages/vi.json', 'utf8')).recipeAdmin as Record<string, string>,
};

describe('what the editor says', () => {
  it('shows a failure while no recipe is open', () => {
    /* The status line sat inside the open-recipe branch, so a failed list
       load read as "0 recipes" and Create with no name did nothing visible. */
    const statusAt = code.indexOf('{status ? (');
    const branchAt = code.search(/\{!editing( \|\| !draft)? \? \(/);
    expect(statusAt).toBeGreaterThan(-1);
    expect(branchAt).toBeGreaterThan(-1);
    expect(statusAt).toBeLessThan(branchAt);
    expect(code.indexOf('{issues.length ? (')).toBeLessThan(branchAt);
  });

  it('does not promise that unticking Published acts before Save', () => {
    for (const side of ['en', 'vi'] as const) {
      expect(messages[side].publishedHint, side).not.toMatch(/immediately|ngay lập tức/i);
    }
  });
});

describe('a recipe saved somewhere else since it was opened', () => {
  it('is opened from the admin read, which carries the version', () => {
    /* The list row could be minutes old; a fresh version beside a stale
       draft would pass the precondition and write the stale draft anyway. */
    const load = handler('load');
    expect(load).toMatch(/fetch\(`\/api\/admin\/recipes\/\$\{id\}`, \{ headers: authed\(\) \}\)/);
    expect(load).toMatch(/setEditing\(opened\(data\.recipe\)\)/);
    expect(handler('open')).toMatch(/void load\(record\.recipe\.id\)/);
  });

  it('names that version on every save', () => {
    expect(handler('save')).toMatch(/expectedUpdatedAt: sent\.stored\.updatedAt/);
  });

  it('reloads from the row after Unpublish rather than pairing a new version with old fields', () => {
    const unpublish = handler('unpublish');
    expect(unpublish).toMatch(/await load\(id\)/);
    expect(unpublish).not.toMatch(/updatedAt: data\.updatedAt/);
  });

  it('has a message for staleEdit that says how to recover', () => {
    for (const side of ['en', 'vi'] as const) {
      const errors = (messages[side] as unknown as { errors: Record<string, string> }).errors;
      expect(errors.staleEdit, side).toBeTruthy();
    }
  });
});

describe('unsaved work is never dropped without asking', () => {
  it('asks before Create replaces an edited draft, and clears the old issues', () => {
    const create = handler('create');
    expect(create).toMatch(/isDirty\(editing\) && !window\.confirm\(t\('discardConfirm'\)\)\) return;/);
    expect(create.indexOf('discardConfirm')).toBeLessThan(create.indexOf('fetch('));
    expect(create).toMatch(/setIssues\(\[\]\)/);
  });

  it('asks before Unpublish discards an edited draft, and resets it to the stored row', () => {
    const unpublish = handler('unpublish');
    expect(unpublish).toMatch(/isDirty\(editing\) && !window\.confirm\(t\('discardConfirm'\)\)\) return;/);
    expect(unpublish).not.toMatch(/\.\.\.draft, published: false/);
  });

  it('offers Unpublish from the stored row, not from a ticked, unsaved box', () => {
    expect(code).toMatch(/editing\.stored\.recipe\.published \? \(/);
    expect(code).not.toMatch(/\{draft\.published \? \(/);
  });

  it('applies a save’s answer to what is open now, not to what was sent', () => {
    const save = handler('save');
    expect(save).toMatch(/const sent = editing;/);
    expect(save).toMatch(/setEditing\(\(cur\) => afterSave\(cur, sent, /);
    expect(save).toMatch(/const body = committed\(sent\);[\s\S]*body: JSON\.stringify\(/);
  });

  it('holds the Tags box as text and commits it on blur', () => {
    expect(code).toMatch(/value=\{editing\.tagText \?\? draft\.tags\.join\(', '\)\}/);
    expect(code).toMatch(/onBlur=\{/);
    expect(code).not.toMatch(/\.replace\(\/\[\^a-z0-9-\]\+\/g/);
  });
});
