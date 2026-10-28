/**
 * The zod-free half of camera highlights: the core spec keys and the admin
 * editor's text form. Apart from the schema in `highlights.ts` so the editor,
 * a client component, ships no zod (src/design/client-graph.test.ts);
 * `highlights.ts` imports the keys and the separator for its schema and
 * re-exports everything here.
 */

import type { Highlights, HighlightsSide } from './highlights';

export const CORE_SPEC_KEYS = [
  'sensor', 'autofocus', 'burst', 'video', 'stabilization', 'screen', 'battery', 'weight',
] as const;
export type CoreSpecKey = (typeof CORE_SPEC_KEYS)[number];

/** The editor's text form: one point per line, `Title :: body`. Declared here,
    beside the draft helpers, and imported by the schema's refinement, so both
    read from one literal rather than two copies of "::" drifting apart. */
export const SEPARATOR = ' :: ';

export type HighlightsDraft = Record<'en' | 'vi', { points: string; specs: Record<CoreSpecKey, string> }>;

const emptySpecs = (): Record<CoreSpecKey, string> =>
  Object.fromEntries(CORE_SPEC_KEYS.map((k) => [k, ''])) as Record<CoreSpecKey, string>;

export function highlightsToDraft(h: Highlights | null): HighlightsDraft {
  const side = (s: HighlightsSide | undefined) => {
    const specs = emptySpecs();
    for (const row of s?.keySpecs ?? []) specs[row.key] = row.value;
    return { points: (s?.points ?? []).map((p) => `${p.title}${SEPARATOR}${p.body}`).join('\n'), specs };
  };
  return { en: side(h?.en), vi: side(h?.vi) };
}

export function draftToHighlights(d: HighlightsDraft): unknown | null {
  const side = (s: HighlightsDraft['en']) => ({
    points: s.points
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const at = line.indexOf(SEPARATOR.trim());
        return at === -1
          ? { title: line, body: '' }
          : { title: line.slice(0, at).trim(), body: line.slice(at + SEPARATOR.trim().length).trim() };
      }),
    keySpecs: CORE_SPEC_KEYS.filter((k) => s.specs[k].trim()).map((k) => ({ key: k, value: s.specs[k].trim() })),
  });
  const out = { en: side(d.en), vi: side(d.vi) };
  const empty = (s: ReturnType<typeof side>) => s.points.length === 0 && s.keySpecs.length === 0;
  return empty(out.en) && empty(out.vi) ? null : out;
}
