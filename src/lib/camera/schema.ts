/**
 * Runtime validation for recipes, derived entirely from `constants.ts`.
 *
 * Nothing in this file hard-codes a camera value. If a range changes upstream,
 * it changes in one place and every check here follows.
 */

import { z } from 'zod';
import {
  CL_MONOCHROME_LOOKS,
  CL_RANGES,
  CREATIVE_LOOK_CODES,
  PP_BLACK_GAMMA_RANGE,
  PP_COLOR_DEPTH_CHANNELS,
  PP_COLOR_MODE,
  PP_DETAIL_BW_BALANCE,
  PP_DETAIL_MODE,
  PP_GAMMA,
  PP_KNEE_AUTO_SENSITIVITY,
  PP_RANGES,
  WB_AUTO_MODES,
  WB_AXIS_AB,
  WB_AXIS_GM,
  WB_KELVIN,
  WB_PRESETS,
  WB_SHIFT_AXIS,
  type Range,
} from './constants';

/**
 * Builds a number schema from a Range, enforcing bounds and step granularity.
 * Step is checked against a rounded integer count to avoid float drift
 * (e.g. 1.75 / 0.25 must land exactly on 7).
 */
function ranged(range: Range, label: string) {
  return z
    .number()
    .min(range.min, `${label} must be >= ${range.min}`)
    .max(range.max, `${label} must be <= ${range.max}`)
    .refine(
      (v) => Math.abs((v - range.min) / range.step - Math.round((v - range.min) / range.step)) < 1e-9,
      `${label} must be in steps of ${range.step}`,
    );
}

// ---------------------------------------------------------------------------
// White Balance
// ---------------------------------------------------------------------------

const wbShiftSchema = z
  .object({
    ab: z
      .object({ axis: z.enum(WB_AXIS_AB), amount: ranged(WB_SHIFT_AXIS, 'WB shift A/B') })
      .optional(),
    gm: z
      .object({ axis: z.enum(WB_AXIS_GM), amount: ranged(WB_SHIFT_AXIS, 'WB shift G/M') })
      .optional(),
  })
  .refine((s) => s.ab || s.gm, 'WB shift must specify at least one axis');

export const whiteBalanceSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('kelvin'),
    kelvin: ranged(WB_KELVIN, 'White balance Kelvin'),
    shift: wbShiftSchema.optional(),
  }),
  z.object({
    mode: z.literal('auto'),
    auto: z.enum(WB_AUTO_MODES),
    shift: wbShiftSchema.optional(),
  }),
  // A light-source preset (Daylight, Cloudy, Underwater Auto, …). Like the Auto
  // modes it has no Kelvin number of its own — the camera picks one — but it
  // still takes a shift, and the Sony Asia recipes use exactly that pairing
  // ("WB Cloudy A1.5, M0.5").
  z.object({
    mode: z.literal('preset'),
    preset: z.enum(WB_PRESETS),
    shift: wbShiftSchema.optional(),
  }),
]);

export type WhiteBalance = z.infer<typeof whiteBalanceSchema>;

// ---------------------------------------------------------------------------
// Picture Profile
// ---------------------------------------------------------------------------

const kneeSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('Auto'),
    maxPoint: ranged(PP_RANGES.kneeAutoMaxPoint, 'Knee Max Point').optional(),
    sensitivity: z.enum(PP_KNEE_AUTO_SENSITIVITY).optional(),
  }),
  z.strictObject({
    mode: z.literal('Manual'),
    point: ranged(PP_RANGES.kneeManualPoint, 'Knee Point'),
    slope: ranged(PP_RANGES.kneeManualSlope, 'Knee Slope'),
  }),
]);

const colorDepthSchema = z.strictObject(
  Object.fromEntries(
    PP_COLOR_DEPTH_CHANNELS.map((c) => [c, ranged(PP_RANGES.colorDepth, `Color Depth ${c}`)]),
  ) as Record<(typeof PP_COLOR_DEPTH_CHANNELS)[number], ReturnType<typeof ranged>>,
);

const detailSchema = z.strictObject({
  level: ranged(PP_RANGES.detailLevel, 'Detail Level'),
  mode: z.enum(PP_DETAIL_MODE),
  vhBalance: ranged(PP_RANGES.detailVhBalance, 'V/H Balance'),
  bwBalance: z.enum(PP_DETAIL_BW_BALANCE),
  limit: ranged(PP_RANGES.detailLimit, 'Detail Limit'),
  crispening: ranged(PP_RANGES.detailCrispening, 'Crispening'),
  hiLightDetail: ranged(PP_RANGES.detailHiLightDetail, 'Hi-Light Detail'),
});

export const ppSettingsSchema = z.strictObject({
  blackLevel: ranged(PP_RANGES.blackLevel, 'Black Level'),
  gamma: z.enum(PP_GAMMA),
  blackGamma: z.strictObject({
    range: z.enum(PP_BLACK_GAMMA_RANGE),
    level: ranged(PP_RANGES.blackGammaLevel, 'Black Gamma Level'),
  }),
  knee: kneeSchema,
  colorMode: z.enum(PP_COLOR_MODE),
  saturation: ranged(PP_RANGES.saturation, 'PP Saturation'),
  colorPhase: ranged(PP_RANGES.colorPhase, 'Color Phase'),
  colorDepth: colorDepthSchema,
  detail: detailSchema,
});

// ---------------------------------------------------------------------------
// Creative Look
// ---------------------------------------------------------------------------

export const clSettingsSchema = z
  .strictObject({
    look: z.enum(CREATIVE_LOOK_CODES),
    contrast: ranged(CL_RANGES.contrast, 'Contrast'),
    highlights: ranged(CL_RANGES.highlights, 'Highlights'),
    shadows: ranged(CL_RANGES.shadows, 'Shadows'),
    fade: ranged(CL_RANGES.fade, 'Fade'),
    /** Omitted for BW/SE — the camera greys it out for monochrome Looks. */
    saturation: ranged(CL_RANGES.saturation, 'CL Saturation').optional(),
    sharpness: ranged(CL_RANGES.sharpness, 'Sharpness'),
    sharpnessRange: ranged(CL_RANGES.sharpnessRange, 'Sharpness Range'),
    clarity: ranged(CL_RANGES.clarity, 'Clarity'),
  })
  .superRefine((v, ctx) => {
    const mono = (CL_MONOCHROME_LOOKS as readonly string[]).includes(v.look);
    if (mono && v.saturation !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['saturation'],
        message: `Saturation cannot be adjusted for the ${v.look} Look (monochrome)`,
      });
    }
    if (!mono && v.saturation === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['saturation'],
        message: `Saturation is required for the ${v.look} Look`,
      });
    }
  });

// ---------------------------------------------------------------------------
// Recipe
// ---------------------------------------------------------------------------

/** `SCL-PP-001` / `SCL-CL-042` — the prefix is retained for SEO continuity. */
export const RECIPE_ID_RE = /^SCL-(PP|CL)-\d{3}$/;

const baseRecipe = {
  id: z.string().regex(RECIPE_ID_RE, 'id must look like SCL-PP-001 or SCL-CL-001'),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be kebab-case'),
  /** Display title, e.g. "SCL-PP-001: Mojave Sun". Never translated. */
  name: z.string().min(1),
  whiteBalance: whiteBalanceSchema,
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  published: z.boolean().default(false),
};

export const recipeSchema = z
  .discriminatedUnion('format', [
    z.object({ ...baseRecipe, format: z.literal('pp'), settings: ppSettingsSchema }),
    z.object({ ...baseRecipe, format: z.literal('cl'), settings: clSettingsSchema }),
  ])
  .superRefine((v, ctx) => {
    const expected = v.format === 'pp' ? 'PP' : 'CL';
    if (!v.id.includes(`-${expected}-`)) {
      ctx.addIssue({
        code: 'custom',
        path: ['id'],
        message: `id segment must match format: expected SCL-${expected}-…`,
      });
    }
  });

export type Recipe = z.infer<typeof recipeSchema>;
export type PpSettings = z.infer<typeof ppSettingsSchema>;
export type ClSettings = z.infer<typeof clSettingsSchema>;
