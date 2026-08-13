import table from '../../../data/spec-values.en.json';

/**
 * Renders a spec value for a locale.
 *
 * Spec values are extracted from Sony Vietnam's pages, so the seed holds the
 * Vietnamese wording and that is the canonical form — `docs/HANDOVER-sony-
 * product-specs.md` prescribes `"17 thành phần / 12 nhóm"` and rejects `"12-17"`
 * because the compact form loses which number is which. The words still have to
 * reach an English reader as English, so they are mapped here rather than
 * stripped from the data.
 *
 * This is the same split the rest of the app uses: numbers and units are
 * language-neutral and pass through untouched (Sony's decimal comma included),
 * only the prose is translated. It is not in `messages/*.json` because these
 * are values, not UI copy, and because the mapping is per-field — the message
 * catalogues are keyed by label, and a value dictionary keyed the same way
 * would collide.
 *
 * A value with no rule is returned unchanged. That is deliberate: it renders
 * the Vietnamese, which is visible and wrong-looking, instead of guessing an
 * English spec. `spec-values.test.ts` lists the ones that currently fall
 * through, all of them extraction bugs in the seed rather than missing rules.
 */

type FieldRules = {
  literals?: Record<string, string>;
  replace?: [string, string][];
};

/* `$comment` is documentation, not a field. */
const RULES = table as unknown as Record<string, FieldRules | string[]>;

function rulesFor(field: string): FieldRules | null {
  const entry = RULES[field];
  if (!entry || Array.isArray(entry)) return null;
  return entry;
}

export function translateSpecValue(field: string, value: string, locale: string): string {
  if (locale === 'vi') return value;

  const rules = rulesFor(field);
  if (!rules) return value;

  const literal = rules.literals?.[value];
  if (literal) return literal;

  /* Ordered, and applied to the accumulating result: a later pair must not be
     able to match inside text an earlier pair already produced. */
  let out = value;
  for (const [from, to] of rules.replace ?? []) {
    out = out.split(from).join(to);
  }
  return out;
}
