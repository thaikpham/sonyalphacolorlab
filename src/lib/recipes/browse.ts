/**
 * Browsing the catalogue by colour system, situation, style and tone — the
 * pure half.
 *
 * The URL shape is one address per result (handoff, "URL"): the situation is
 * the path, `/colorlab/[situation]`; style, tone, the colour system and the
 * text query are the query string. `?situation=` is not read, so a shared link
 * has exactly one spelling. The filters AND across the four groups and each
 * group takes one value, which is what keeps a chip row readable on a phone.
 *
 * The colour system is `?format=pp|cl` — the same parameter and values the
 * previous catalogue used, so a link shared from it keeps its meaning.
 *
 * Client-safe: the header's URL builder and the server filter row both import
 * from here, and nothing here reads a file or a database.
 */

import { RECIPE_FORMATS, type RecipeFormat } from '@/lib/camera/constants';
import {
  MIN_SITUATION_RECIPES,
  SITUATIONS,
  STYLES,
  TONES,
  parseSituation,
  parseStyle,
  parseTone,
  type RecipeTaxonomy,
  type SituationId,
  type StyleId,
  type ToneId,
} from './taxonomy';

export type BrowseFilters = {
  readonly situation: SituationId | null;
  readonly style: StyleId | null;
  readonly tone: ToneId | null;
  readonly format: RecipeFormat | null;
  readonly q: string;
};

export const NO_FILTERS: BrowseFilters = { situation: null, style: null, tone: null, format: null, q: '' };

/** `pp` or `cl`, exactly; anything else is no colour system. */
export const parseFormat = (v: unknown): RecipeFormat | null =>
  (RECIPE_FORMATS as readonly unknown[]).includes(v) ? (v as RecipeFormat) : null;

type RawParam = string | string[] | undefined;

/** The first of a repeated parameter; an unknown value is no value. */
const one = (v: RawParam): string | undefined => {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === 'string' && x !== '' ? x : undefined;
};

/**
 * Filters from a situation segment and the query string. The segment has
 * already been validated by the route (an unknown one is a 404); a bad
 * `style` or `tone` is simply absent, because a reader hand-editing a link
 * should see the catalogue, not an error.
 */
export function browseFilters(
  situation: SituationId | null,
  sp: Readonly<Record<string, RawParam>>,
): BrowseFilters {
  return {
    situation,
    style: parseStyle(one(sp.style)),
    tone: parseTone(one(sp.tone)),
    format: parseFormat(one(sp.format)),
    q: one(sp.q)?.trim() ?? '',
  };
}

export const hasBrowseFilters = (f: BrowseFilters): boolean =>
  Boolean(f.situation || f.style || f.tone || f.format || f.q);

/* --------------------------------------------------------------------- */
/* URLs                                                                   */
/* --------------------------------------------------------------------- */

export const colorlabPath = (situation: SituationId | null | undefined): string =>
  situation ? `/colorlab/${situation}` : '/colorlab';

export type ColorlabPatch = { q?: string; style?: string; tone?: string; format?: string };

/**
 * The catalogue's query string after `patch`, every empty left out — the
 * ColorLab twin of `wikiSearch`. The header's search box goes through here, so
 * typing a query keeps the style, tone and colour system already chosen (it
 * used to rebuild the string from `q` alone), and the no-JS form's hidden
 * inputs are read from the same builder. The order is fixed — q, style, tone,
 * format — so one filter state has one spelling.
 */
export function colorlabSearch(
  current: { get(name: string): string | null } | null,
  patch: ColorlabPatch,
): string {
  const pick = (key: keyof ColorlabPatch) =>
    patch[key] !== undefined ? (patch[key] as string) : (current?.get(key) ?? '');
  const next = new URLSearchParams();
  const q = pick('q').trim();
  const style = parseStyle(pick('style'));
  const tone = parseTone(pick('tone'));
  const format = parseFormat(pick('format'));
  if (q) next.set('q', q);
  if (style) next.set('style', style);
  if (tone) next.set('tone', tone);
  if (format) next.set('format', format);
  return next.toString();
}

/** The address of a filter state. */
export function browseHref(f: BrowseFilters): string {
  const qs = colorlabSearch(null, { q: f.q, style: f.style ?? '', tone: f.tone ?? '', format: f.format ?? '' });
  return colorlabPath(f.situation) + (qs ? `?${qs}` : '');
}

/* --------------------------------------------------------------------- */
/* Matching and counting                                                  */
/* --------------------------------------------------------------------- */

export type Browsable = RecipeTaxonomy & { readonly format: RecipeFormat };

/** The four group filters, without the text query — that is `matchesQuery`. */
export function matchesBrowse(
  r: Browsable,
  f: Pick<BrowseFilters, 'situation' | 'style' | 'tone' | 'format'>,
): boolean {
  return (
    (!f.format || r.format === f.format) &&
    (!f.situation || r.situations.includes(f.situation)) &&
    (!f.style || r.style === f.style) &&
    (!f.tone || r.tone === f.tone)
  );
}

export type Facets = {
  readonly formats: Readonly<Record<RecipeFormat, number>>;
  readonly situations: Readonly<Record<SituationId, number>>;
  readonly styles: Readonly<Record<StyleId, number>>;
  readonly tones: Readonly<Record<ToneId, number>>;
};

const zeros = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

/**
 * How many recipes each chip would show: each group is counted with the OTHER
 * three groups and the text query applied, so a chip's number is what pressing
 * it yields rather than a total that the current selection has already
 * narrowed. `recipes` must already be narrowed by the text query.
 */
export function facetCounts<T extends Browsable>(recipes: readonly T[], f: BrowseFilters): Facets {
  const formats = zeros(RECIPE_FORMATS);
  const situations = zeros(SITUATIONS);
  const styles = zeros(STYLES);
  const tones = zeros(TONES);
  for (const r of recipes) {
    if (matchesBrowse(r, { ...f, format: null })) formats[r.format] += 1;
    if (matchesBrowse(r, { ...f, situation: null })) for (const s of r.situations) situations[s] += 1;
    if (matchesBrowse(r, { ...f, style: null })) styles[r.style] += 1;
    if (matchesBrowse(r, { ...f, tone: null })) tones[r.tone] += 1;
  }
  return { formats, situations, styles, tones };
}

/** Recipes per situation, over the whole published catalogue. */
export function situationCounts<T extends RecipeTaxonomy>(recipes: readonly T[]): Record<SituationId, number> {
  const counts = zeros(SITUATIONS);
  for (const r of recipes) for (const s of r.situations) counts[s] += 1;
  return counts;
}

/**
 * The situations worth a tile and a sitemap entry: those with at least
 * `MIN_SITUATION_RECIPES` published recipes, in the taxonomy's own order. A
 * situation with one or two recipes reads as a broken page, so it stays a
 * valid route (its chip still appears once a recipe carries it) but is not
 * advertised.
 */
export function visibleSituations<T extends RecipeTaxonomy>(recipes: readonly T[]): SituationId[] {
  const counts = situationCounts(recipes);
  return SITUATIONS.filter((s) => counts[s] >= MIN_SITUATION_RECIPES);
}

export const isSituation = (v: unknown): v is SituationId => parseSituation(v) !== null;
