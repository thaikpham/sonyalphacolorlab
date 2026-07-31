/**
 * Sony camera constants — THE single source of truth for Alpha ColorLab.
 *
 * Every legal enum and numeric range lives here. `schema.ts` derives its
 * validation from this file, so a value that is not representable here cannot
 * be stored, displayed, or produced by the AI tweak endpoint.
 *
 * RULE: never hand-write a camera value anywhere else in the codebase, and
 * never edit a number here from memory. Each block cites its source URL.
 * To change anything, re-read the source and update the citation.
 *
 * Sources:
 *  PP  — https://helpguide.sony.net/di/pp/v1/en/contents/TP0000909109.html (Gamma / Color Mode)
 *        https://helpguide.sony.net/di/pp/v1/en/contents/TP0000909110.html (Black Level / Black Gamma / Knee)
 *        https://helpguide.sony.net/di/pp/v1/en/contents/TP0000909111.html (Saturation / Color Phase / Color Depth)
 *        https://helpguide.sony.net/di/pp/v1/en/contents/TP0000909112.html (Detail)
 *  CL  — https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000640837.html (ILCE-7M4 Creative Look)
 */

/** A closed numeric interval, inclusive of both bounds. */
export type Range = { readonly min: number; readonly max: number; readonly step: number };

const r = (min: number, max: number, step = 1): Range => ({ min, max, step });

// ---------------------------------------------------------------------------
// White Balance — shared by both recipe formats
// ---------------------------------------------------------------------------

/**
 * Kelvin range for manual colour temperature.
 * NOTE: 2500–9900 is the standard Alpha range; confirm against your body.
 */
export const WB_KELVIN = r(2500, 9900, 100);

/**
 * WB Shift grid. The camera shows two axes: amber↔blue and green↔magenta.
 * Step 0.25 is derived from the existing 47-recipe corpus, which contains
 * values such as `A7-M0.25` and `B3-G0.25`. Confirm against your body.
 */
export const WB_SHIFT_AXIS = r(0, 7, 0.25);

/**
 * Auto white balance modes that appear in place of a Kelvin value.
 *
 * ⚠ These are the *legacy dataset's* names. Sony's own menu calls them
 * `Auto`, `Auto: White` and `Auto: Ambience` (see WB_PRESETS' citation).
 * Do not "correct" them: 46 shipping recipes, the `wb_auto` CHECK constraint in
 * `0001_init.sql` and every legacy redirect carry these exact strings. Renaming
 * is a data migration, not an edit.
 */
export const WB_AUTO_MODES = ['AWB', 'AWB (Priority White)', 'AWB (Priority Ambience)'] as const;

/**
 * Light-source presets — the third way to set White Balance, alongside a Kelvin
 * value and the Auto modes above.
 *
 * Source: ILCE-7M4 help guide, "White Balance (still image/movie)"
 * https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000640840.html
 *
 * Listed there in menu order as: Auto / Auto: Ambience / Auto: White / Daylight
 * / Shade / Cloudy / Incandescent / Fluor.: Warm White / Fluor.: Cool White /
 * Fluor.: Day White / Fluor.: Daylight / Flash (only when shooting still
 * images) / Underwater Auto / C.Temp./Filter / Custom 1-3.
 *
 * The Auto entries live in WB_AUTO_MODES and C.Temp./Filter is the Kelvin mode,
 * so only the light-source presets are here.
 *
 * `Custom 1`–`Custom 3` are deliberately excluded. They replay a white card
 * measured in one photographer's room; the name carries no colour and cannot be
 * reproduced by a reader, so it is not a shareable recipe value.
 */
export const WB_PRESETS = [
  'Daylight',
  'Shade',
  'Cloudy',
  'Incandescent',
  'Fluor.: Warm White',
  'Fluor.: Cool White',
  'Fluor.: Day White',
  'Fluor.: Daylight',
  'Flash',
  'Underwater Auto',
] as const;

/** Sony documents Flash as "only when shooting still images". */
export const WB_PRESETS_STILL_ONLY = ['Flash'] as const;

/** Axis letters. A=amber B=blue on one axis, G=green M=magenta on the other. */
export const WB_AXIS_AB = ['A', 'B'] as const;
export const WB_AXIS_GM = ['G', 'M'] as const;

// ---------------------------------------------------------------------------
// Format 1 — Picture Profile (PP)
// ---------------------------------------------------------------------------

export const PP_GAMMA = [
  'Movie', 'Still', 'S-Cinetone',
  'Cine1', 'Cine2', 'Cine3', 'Cine4',
  'ITU709', 'ITU709(800%)',
  'S-Log2', 'S-Log3',
  'HLG', 'HLG1', 'HLG2', 'HLG3',
] as const;

export const PP_COLOR_MODE = [
  'Movie', 'Still', 'S-Cinetone', 'Cinema', 'Pro',
  '709tone', 'ITU709 Matrix', 'Black & White',
  'S-Gamut', 'S-Gamut3', 'S-Gamut3.Cine',
  'BT.2020', '709',
] as const;

export const PP_BLACK_GAMMA_RANGE = ['Narrow', 'Middle', 'Wide'] as const;
export const PP_KNEE_MODE = ['Auto', 'Manual'] as const;
export const PP_KNEE_AUTO_SENSITIVITY = ['Low', 'Mid', 'High'] as const;
export const PP_DETAIL_MODE = ['Auto', 'Manual'] as const;

/** Sony writes these without a space: Type1 … Type5. */
export const PP_DETAIL_BW_BALANCE = ['Type1', 'Type2', 'Type3', 'Type4', 'Type5'] as const;

/** The six colour phases adjustable under Color Depth. */
export const PP_COLOR_DEPTH_CHANNELS = ['R', 'G', 'B', 'C', 'M', 'Y'] as const;

/**
 * The Picture Profile menu on an Alpha body has exactly these 9 setting items
 * (Copy and Reset are actions, not settings). Source TP0000909111 additionally
 * documents COLOR CORRECTION and WB SHIFT as PP items — those belong to the
 * camcorder line (FX / Z-series) and are deliberately NOT modelled here.
 * Do not add them.
 */
export const PP_MENU_ITEMS = [
  'Black Level', 'Gamma', 'Black Gamma', 'Knee', 'Color Mode',
  'Saturation', 'Color Phase', 'Color Depth', 'Detail',
] as const;

export const PP_RANGES = {
  blackLevel: r(-15, 15),
  blackGammaLevel: r(-7, 7),
  kneeAutoMaxPoint: r(90, 100),      // percent
  kneeManualPoint: r(75, 105, 0.5),  // percent; corpus contains 92.5%, 87.5%, 77.5%
  kneeManualSlope: r(-5, 5),
  saturation: r(-32, 32),            // NOT the same as Creative Look saturation
  colorPhase: r(-7, 7),
  colorDepth: r(-7, 7),              // applies to each of R G B C M Y
  detailLevel: r(-7, 7),
  detailVhBalance: r(-2, 2),
  detailLimit: r(0, 7),
  detailCrispening: r(0, 7),
  detailHiLightDetail: r(0, 4),
} as const satisfies Record<string, Range>;

// ---------------------------------------------------------------------------
// Format 2 — Creative Look (CL)
// ---------------------------------------------------------------------------

/** The ten built-in Looks. `code` is what the camera displays. */
export const CREATIVE_LOOKS = [
  { code: 'ST',  label: 'Standard' },
  { code: 'PT',  label: 'Portrait' },
  { code: 'NT',  label: 'Neutral' },
  { code: 'VV',  label: 'Vivid' },
  { code: 'VV2', label: 'Vivid 2' },
  { code: 'FL',  label: 'Film' },
  { code: 'IN',  label: 'Instant' },
  { code: 'SH',  label: 'Soft Highkey' },
  { code: 'BW',  label: 'Black & White' },
  { code: 'SE',  label: 'Sepia' },
] as const;

export const CREATIVE_LOOK_CODES = CREATIVE_LOOKS.map((l) => l.code) as readonly CreativeLookCode[];

/**
 * Looks that render monochrome. The camera greys out Saturation for these:
 * "When this function is set to [BW(Black & White)] or [SE(Sepia)],
 *  [Saturation] cannot be adjusted."
 */
export const CL_MONOCHROME_LOOKS = ['BW', 'SE'] as const;

/**
 * Creative Look adjustment ranges.
 *
 * CAREFUL — four of these are unsigned and are a frequent source of bad data:
 *   fade, sharpness, clarity   start at 0 (never negative)
 *   sharpnessRange            starts at 1 (never 0, never signed)
 * And `saturation` here is -9..+9, NOT the -32..+32 of Picture Profile.
 */
export const CL_RANGES = {
  contrast: r(-9, 9),
  highlights: r(-9, 9),
  shadows: r(-9, 9),
  fade: r(0, 9),
  saturation: r(-9, 9),
  sharpness: r(0, 9),
  sharpnessRange: r(1, 5),
  clarity: r(0, 9),
} as const satisfies Record<string, Range>;

/** Parameters the camera displays with an explicit +/- sign. */
export const CL_SIGNED_PARAMS = ['contrast', 'highlights', 'shadows', 'saturation'] as const;

/** Display order on the camera's adjustment screen — drives UI table order. */
export const CL_PARAM_ORDER = [
  'contrast', 'highlights', 'shadows', 'fade',
  'saturation', 'sharpness', 'sharpnessRange', 'clarity',
] as const;

/** Human labels. These are technical terms and are never translated. */
export const CL_PARAM_LABELS: Record<ClParam, string> = {
  contrast: 'Contrast',
  highlights: 'Highlights',
  shadows: 'Shadows',
  fade: 'Fade',
  saturation: 'Saturation',
  sharpness: 'Sharpness',
  sharpnessRange: 'Sharpness Range',
  clarity: 'Clarity',
};

// ---------------------------------------------------------------------------
// Cross-format rule
// ---------------------------------------------------------------------------

/**
 * Picture Profile and Creative Look are mutually exclusive on the camera:
 * "[Creative Look] is fixed to [-] ... when [Picture Profile] is set to other
 * than [Off]."  A recipe is therefore exactly one format, never both.
 */
export const RECIPE_FORMATS = ['pp', 'cl'] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecipeFormat = (typeof RECIPE_FORMATS)[number];
export type PpGamma = (typeof PP_GAMMA)[number];
export type PpColorMode = (typeof PP_COLOR_MODE)[number];
export type PpBlackGammaRange = (typeof PP_BLACK_GAMMA_RANGE)[number];
export type PpDetailBwBalance = (typeof PP_DETAIL_BW_BALANCE)[number];
export type PpColorDepthChannel = (typeof PP_COLOR_DEPTH_CHANNELS)[number];
export type CreativeLookCode = (typeof CREATIVE_LOOKS)[number]['code'];
export type ClParam = keyof typeof CL_RANGES;
