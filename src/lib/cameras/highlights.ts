import { z } from 'zod';
import { CORE_SPEC_KEYS, SEPARATOR } from './highlights-draft';

/**
 * What a camera page shows a buyer instead of the raw feature bullets and the
 * 12-row table: 4–6 explained points and up to eight plain core specs, in both
 * languages. Stored in `sony_cameras.highlights`; validated on every read and
 * every admin write, so a malformed row renders the old page instead of a
 * broken one. See docs/superpowers/specs/2026-10-07-camera-highlights-sales-talk-design.md.
 */

export {
  CORE_SPEC_KEYS,
  draftToHighlights,
  highlightsToDraft,
  type CoreSpecKey,
  type HighlightsDraft,
} from './highlights-draft';

/* A title or body with a `\r`/`\n` inside it is schema-valid but cannot
   round-trip through the editor's one-point-per-line text form: joining
   points with `\n` and splitting on `\n` would turn one point into two (or
   swallow the line break silently). `.trim()` only strips the ends, so an
   embedded break still fails this check after trimming. */
const noLineBreak = (s: string) => !/[\r\n]/.test(s);
const text = (max: number) =>
  z.string().trim().min(1).max(max).refine(noLineBreak, 'must not contain a line break');

/* A title containing the literal separator is schema-valid but ambiguous in
   the text form: `draftToHighlights` cuts at the FIRST "::" it finds, so
   "Fast :: AF :: Locks on" would be read back as title "Fast" — silently
   losing "AF" into the body. Body is unaffected: only the first "::" on a
   line is ever treated as the boundary, so "::" later in the body round-trips
   fine. */
const titleText = (max: number) =>
  text(max).refine((s) => !s.includes(SEPARATOR.trim()), `must not contain "${SEPARATOR.trim()}"`);

const sideSchema = z.strictObject({
  points: z.array(z.strictObject({ title: titleText(80), body: text(320) })).min(4).max(6),
  keySpecs: z
    .array(z.strictObject({ key: z.enum(CORE_SPEC_KEYS), value: text(160) }))
    .max(CORE_SPEC_KEYS.length)
    .refine((rows) => new Set(rows.map((r) => r.key)).size === rows.length, 'a core spec appears twice'),
});

export const highlightsSchema = z.strictObject({ en: sideSchema, vi: sideSchema });
export type Highlights = z.infer<typeof highlightsSchema>;
export type HighlightsSide = Highlights['en'];

/** `id` is the product this value was read from, so the log names which row
    to go fix — a validation failure with no id is a search through the whole
    catalogue. */
export function parseHighlights(value: unknown, id?: string): Highlights | null {
  if (value === null || value === undefined) return null;
  const parsed = highlightsSchema.safeParse(value);
  if (!parsed.success) {
    console.error(
      `[highlights] ${id ?? 'unknown product'} failed validation; rendering the fallback page:`,
      parsed.error.issues.map((issue) => issue.path.join('.')),
    );
    return null;
  }
  return parsed.data;
}

export function highlightsFor(h: Highlights | null | undefined, locale: string): HighlightsSide | null {
  if (!h) return null;
  return locale === 'vi' ? h.vi : h.en;
}
