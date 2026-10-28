/**
 * Kept apart from `redirects.ts`, which reads `data/*.json` from disk for
 * `next.config.ts`: /admin needs the withdrawn ids at request time
 * (`computedRecipeName`), and a route must not depend on a file read relative
 * to the working directory.
 */

/**
 * The Picture Profiles withdrawn on 2026-10-23 — each legacy id and the slug
 * of the original cooked to the same purpose, or null where nothing replaces
 * it (three experiments). Ids only, no settings: the reason they are gone is
 * "withdrawn: matches a licensed third-party collection", and a public
 * repository is the last place to keep their numbers.
 *
 * Written in the slugs the originals were first published under; the
 * replacement's code slug (`pp-058`) is read through `data/former-slugs.json`
 * in `redirects.ts`, so the table is never retyped when a slug moves.
 */
export const RETIRED_REPLACED_BY: Readonly<Record<string, string | null>> = {
  'scl-003': 'neon-night',
  'scl-004': 'cho-lon-slide',
  'scl-005': 'da-lat-mist',
  'scl-006': 'da-lat-mist',
  'scl-007': 'cho-lon-slide',
  'scl-008': 'clear-day',
  'scl-010': 'ha-noi-winter',
  'scl-011': 'neon-night',
  'scl-012': 'ho-tay-golden',
  'scl-013': 'mekong-noon',
  'scl-014': 'tam-coc-green',
  'scl-016': 'clear-day',
  'scl-017': 'hue-silk',
  'scl-018': 'vung-tau-pop',
  'scl-019': 'vung-tau-pop',
  'scl-020': 'ha-noi-winter',
  'scl-021': 'da-lat-mist',
  'scl-022': 'linen-editorial',
  'scl-023': 'moc-chau-frost',
  'scl-024': 'moc-chau-frost',
  'scl-026': 'mui-ne-dusk',
  'scl-028': 'hoi-an-lantern',
  'scl-029': 'sai-gon-cafe',
  'scl-030': 'old-quarter-mono',
  'scl-031': 'hem-noir',
  'scl-032': 'hem-noir',
  'scl-033': 'pearl-mono',
  'scl-034': 'old-quarter-mono',
  'scl-035': 'old-quarter-mono',
  'scl-036': 'hem-noir',
  'scl-037': 'late-night-mono',
  'scl-038': 'pearl-mono',
  'scl-039': null,
  'scl-040': null,
  'scl-041': null,
  'scl-043': 'tam-coc-green',
};

/**
 * The withdrawn recipes' catalogue ids, for the content-plane script and for
 * /admin's naming: the legacy number in the code shape (`scl-003` →
 * `PP-003`), like every other row once the content migration has run (S4).
 */
export const RETIRED_RECIPE_IDS: readonly string[] = Object.keys(RETIRED_REPLACED_BY).map(
  (legacyId) => `PP-${legacyId.slice(4)}`,
);
