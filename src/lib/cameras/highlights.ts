import { z } from 'zod';

/**
 * What a camera page shows a buyer instead of the raw feature bullets and the
 * 12-row table: 4–6 explained points and up to eight plain core specs, in both
 * languages. Stored in `sony_cameras.highlights`; validated on every read and
 * every admin write, so a malformed row renders the old page instead of a
 * broken one. See docs/superpowers/specs/2026-10-07-camera-highlights-sales-talk-design.md.
 */

export const CORE_SPEC_KEYS = [
  'sensor', 'autofocus', 'burst', 'video', 'stabilization', 'screen', 'battery', 'weight',
] as const;
export type CoreSpecKey = (typeof CORE_SPEC_KEYS)[number];

const text = (max: number) => z.string().trim().min(1).max(max);

const sideSchema = z.strictObject({
  points: z.array(z.strictObject({ title: text(80), body: text(320) })).min(4).max(6),
  keySpecs: z
    .array(z.strictObject({ key: z.enum(CORE_SPEC_KEYS), value: text(160) }))
    .max(CORE_SPEC_KEYS.length)
    .refine((rows) => new Set(rows.map((r) => r.key)).size === rows.length, 'a core spec appears twice'),
});

export const highlightsSchema = z.strictObject({ en: sideSchema, vi: sideSchema });
export type Highlights = z.infer<typeof highlightsSchema>;
export type HighlightsSide = Highlights['en'];

export function parseHighlights(value: unknown): Highlights | null {
  if (value === null || value === undefined) return null;
  const parsed = highlightsSchema.safeParse(value);
  if (!parsed.success) {
    console.warn('[highlights] stored value failed validation; rendering the fallback page');
    return null;
  }
  return parsed.data;
}

export function highlightsFor(h: Highlights | null | undefined, locale: string): HighlightsSide | null {
  if (!h) return null;
  return locale === 'vi' ? h.vi : h.en;
}

/** The editor's text form: one point per line, `Title :: body`. */
const SEPARATOR = ' :: ';

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
