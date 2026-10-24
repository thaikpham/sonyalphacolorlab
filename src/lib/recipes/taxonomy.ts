/**
 * The browse taxonomy: what a recipe is FOR (situations), what it is like
 * (style) and how it leans (tone).
 *
 * Editorial data, not Sony values — which is why it lives here and not in
 * `camera/constants.ts`. The ids are stable keys for URLs and the manifest;
 * the display labels are in `messages/*.json` under `browse`, and the
 * synonyms below are the search vocabulary: every spelling a reader might type
 * for an id, in both languages, with and without diacritics (the search fold
 * strips them, so only one spelling of each diacritic form is needed).
 *
 * Client-safe on purpose: no JSON manifest, no server read. The header imports
 * this for its URL builder, and the manifest lives in `taxonomy-assign.ts`.
 */

import { CL_MONOCHROME_LOOKS, PP_RANGES } from '../camera/constants';
import { MIRED_PER_SHIFT_STEP, wbBalance } from '../camera/color';
import type { Recipe, WhiteBalance } from '../camera/schema';

export const SITUATIONS = [
  'portrait',
  'daily',
  'street',
  'travel',
  'landscape',
  'lifestyle',
  'fashion',
  'heritage',
  'night',
  'livestream',
] as const;
export type SituationId = (typeof SITUATIONS)[number];

/** The owner's four words: hài hoà, dynamic range, tươi tắn, retro phim. */
export const STYLES = ['natural', 'range', 'vivid', 'film'] as const;
export type StyleId = (typeof STYLES)[number];

export const TONES = ['warm', 'neutral', 'cool', 'mono'] as const;
export type ToneId = (typeof TONES)[number];

/** A recipe belongs to at most this many situations. */
export const MAX_SITUATIONS = 3;

/** A situation is browsable only once this many published recipes carry it. */
export const MIN_SITUATION_RECIPES = 3;

export type RecipeTaxonomy = {
  readonly situations: readonly SituationId[];
  readonly style: StyleId;
  readonly tone: ToneId;
};

/**
 * What a reader might type for each id. The first entry of each list is the
 * Vietnamese label and the second the English one, so a test can pin the
 * display labels to the vocabulary without the vocabulary knowing the
 * messages.
 */
export const SITUATION_SYNONYMS: Readonly<Record<SituationId, readonly string[]>> = {
  portrait: ['chân dung', 'portrait', 'người mẫu', 'chụp người'],
  daily: ['đời thường', 'everyday', 'hằng ngày', 'hàng ngày', 'daily', 'daily life'],
  street: ['đường phố', 'street', 'phố', 'street style', 'street photography'],
  travel: ['du lịch', 'travel', 'đi chơi', 'đi du lịch'],
  landscape: [
    'phong cảnh & thiên nhiên',
    'landscape & nature',
    'phong cảnh',
    'thiên nhiên',
    'núi',
    'biển',
    'landscape',
    'nature',
  ],
  lifestyle: ['lifestyle & cà phê', 'lifestyle & café', 'cà phê', 'cafe', 'café', 'quán', 'lifestyle'],
  fashion: ['thời trang', 'fashion', 'lookbook', 'street style'],
  heritage: [
    'áo dài & tết',
    'áo dài & lunar new year',
    'áo dài',
    'cổ phục',
    'tết',
    'lễ hội',
    'lunar new year',
  ],
  night: ['ban đêm', 'night', 'đêm', 'đèn neon', 'chợ đêm', 'neon', 'night market'],
  livestream: ['livestream', 'livestream', 'live', 'bán hàng', 'live stream', 'stream'],
};

export const STYLE_SYNONYMS: Readonly<Record<StyleId, readonly string[]>> = {
  natural: ['hài hoà', 'natural', 'hài hòa', 'tự nhiên', 'cân bằng', 'balanced'],
  range: ['dynamic range', 'dynamic range', 'dải sáng', 'log', 'hdr', 'hlg', 'flat'],
  vivid: ['tươi tắn', 'vivid', 'rực rỡ', 'rực', 'tươi', 'bão hoà', 'saturated', 'punchy'],
  film: ['retro phim', 'film look', 'màu phim', 'phim', 'film', 'retro', 'vintage', 'analog'],
};

export const TONE_SYNONYMS: Readonly<Record<ToneId, readonly string[]>> = {
  warm: ['ấm', 'warm', 'ấm áp', 'tông ấm'],
  neutral: ['trung tính', 'neutral', 'trung tinh'],
  cool: ['lạnh', 'cool', 'tông lạnh'],
  mono: [
    'đen trắng',
    'black & white',
    'black and white',
    'b&w',
    'bw',
    'mono',
    'monochrome',
    'trắng đen',
  ],
};

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

/** The id, or null — never a throw, because the input is a URL. */
export const parseSituation = (v: unknown): SituationId | null =>
  isOneOf(SITUATIONS, v) ? v : null;
export const parseStyle = (v: unknown): StyleId | null => (isOneOf(STYLES, v) ? v : null);
export const parseTone = (v: unknown): ToneId | null => (isOneOf(TONES, v) ? v : null);

/** Every search term a recipe inherits from its taxonomy, both languages. */
export function taxonomyTerms(t: RecipeTaxonomy): string[] {
  return [
    ...t.situations.flatMap((s) => SITUATION_SYNONYMS[s]),
    ...STYLE_SYNONYMS[t.style],
    ...TONE_SYNONYMS[t.tone],
  ];
}

/* --------------------------------------------------------------------- */
/* Derivation from the recipe's own settings                              */
/* --------------------------------------------------------------------- */

/**
 * Black & white is the one classification the settings state exactly: a
 * Picture Profile in the Black & White colour mode, or a monochrome Look.
 * Everything else is an estimate or an editor's call.
 */
export const isMonochrome = (r: Recipe): boolean =>
  r.format === 'pp'
    ? r.settings.colorMode === 'Black & White'
    : (CL_MONOCHROME_LOOKS as readonly string[]).includes(r.settings.look);

/**
 * Warm, neutral or cool, from the white balance alone.
 *
 * Only right for a recipe meant for daylight — Sài Gòn Café reads strongly
 * cool here and is warm under the bulbs it was designed for — which is why the
 * manifest may override it. The band is one shift step while the recipe sets
 * an amber–blue shift (`wbSummary`'s rule: never name a cast inside one step
 * of neutral), and 12 mired on a bare Kelvin, where 5900K is the first value
 * that reads warm.
 */
export function toneFromWhiteBalance(wb: WhiteBalance): Exclude<ToneId, 'mono'> {
  const { warmth } = wbBalance(wb);
  const band = wb.shift?.ab ? MIRED_PER_SHIFT_STEP : 12;
  if (warmth >= band) return 'warm';
  if (warmth <= -band) return 'cool';
  return 'neutral';
}

/** The style a recipe's own numbers suggest, for a recipe no editor has placed. */
export function styleFromSettings(r: Recipe): StyleId {
  if (r.format === 'cl') {
    switch (r.settings.look) {
      case 'FL':
      case 'IN':
      case 'SE':
      case 'BW':
        return 'film';
      case 'VV':
      case 'VV2':
        return 'vivid';
      default:
        return 'natural';
    }
  }
  const { gamma, saturation } = r.settings;
  if (gamma.startsWith('S-Log') || gamma.startsWith('HLG')) return 'range';
  if (saturation >= PP_RANGES.saturation.max / 2) return 'vivid';
  return 'natural';
}

/**
 * Where a Creative Look recipe belongs, from its Look and its numbers. A Film
 * Look with a high Fade is a café, one with Clarity or Contrast up is a street;
 * the rest of each Look's defaults are the handoff's card sort. A Picture
 * Profile without a manifest entry belongs nowhere until an editor places it.
 */
export function situationsFromSettings(r: Recipe): readonly SituationId[] {
  if (r.format === 'pp') return [];
  const s = r.settings;
  switch (s.look) {
    case 'FL':
      if (s.fade >= 3) return ['lifestyle', 'daily'];
      if (s.clarity >= 4 || s.contrast >= 2) return ['street', 'daily'];
      return ['daily', 'street'];
    case 'IN':
      return ['lifestyle', 'daily'];
    case 'VV':
    case 'VV2':
      return ['travel', 'landscape'];
    case 'ST':
      return ['daily', 'travel'];
    case 'SH':
      return ['portrait', 'lifestyle', 'fashion'];
    case 'PT':
      return ['portrait'];
    case 'NT':
      return ['daily', 'portrait'];
    case 'BW':
    case 'SE':
      return ['street', 'daily'];
  }
}

/** The whole taxonomy a recipe's settings suggest, before any editor's say. */
export function deriveTaxonomy(r: Recipe): RecipeTaxonomy {
  return {
    situations: situationsFromSettings(r),
    style: styleFromSettings(r),
    tone: isMonochrome(r) ? 'mono' : toneFromWhiteBalance(r.whiteBalance),
  };
}
