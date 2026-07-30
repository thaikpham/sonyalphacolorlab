/**
 * Renders the camera's legal ranges as prompt text.
 *
 * Generated from `constants.ts`, never hand-written — a prompt that restates
 * ranges is a second source of truth, and the moment it drifts the model is
 * being told the wrong rules with total confidence.
 *
 * Structured outputs strip numeric bounds from the JSON Schema they send (the
 * spec does not support `minimum`/`maximum`), so the schema alone cannot keep
 * a value in range. Stating the bounds in the prompt is what gets them right
 * first time; Zod re-validation is what guarantees it.
 */

import {
  CL_PARAM_LABELS,
  CL_PARAM_ORDER,
  CL_RANGES,
  CREATIVE_LOOKS,
  CL_MONOCHROME_LOOKS,
  PP_BLACK_GAMMA_RANGE,
  PP_COLOR_DEPTH_CHANNELS,
  PP_COLOR_MODE,
  PP_GAMMA,
  PP_RANGES,
  WB_KELVIN,
  WB_SHIFT_AXIS,
  type Range,
} from '../camera/constants';

const span = (r: Range) =>
  `${r.min} to ${r.max}${r.step !== 1 ? ` in steps of ${r.step}` : ''}`;

export function ppConstraints(): string {
  const cd = PP_COLOR_DEPTH_CHANNELS.join('/');
  return [
    'PICTURE PROFILE — legal values:',
    `- Black Level: ${span(PP_RANGES.blackLevel)}`,
    `- Gamma: one of ${PP_GAMMA.join(', ')}`,
    `- Black Gamma range: ${PP_BLACK_GAMMA_RANGE.join('/')}; level ${span(PP_RANGES.blackGammaLevel)}`,
    `- Knee: Auto, or Manual with point ${span(PP_RANGES.kneeManualPoint)} percent and slope ${span(PP_RANGES.kneeManualSlope)}`,
    `- Color Mode: one of ${PP_COLOR_MODE.join(', ')}`,
    `- Saturation: ${span(PP_RANGES.saturation)}  <-- NOT the same range as Creative Look saturation`,
    `- Color Phase: ${span(PP_RANGES.colorPhase)}`,
    `- Color Depth ${cd}: each ${span(PP_RANGES.colorDepth)}`,
    `- Detail level ${span(PP_RANGES.detailLevel)}, V/H Balance ${span(PP_RANGES.detailVhBalance)}, Limit ${span(PP_RANGES.detailLimit)}, Crispening ${span(PP_RANGES.detailCrispening)}, Hi-Light Detail ${span(PP_RANGES.detailHiLightDetail)}`,
  ].join('\n');
}

export function clConstraints(): string {
  const params = CL_PARAM_ORDER.map(
    (p) => `- ${CL_PARAM_LABELS[p]}: ${span(CL_RANGES[p])}`,
  );
  return [
    'CREATIVE LOOK — legal values:',
    `- Look: one of ${CREATIVE_LOOKS.map((l) => l.code).join(', ')}`,
    ...params,
    `- Saturation must be OMITTED entirely for the monochrome Looks (${CL_MONOCHROME_LOOKS.join(', ')}); the camera greys it out.`,
  ].join('\n');
}

export function wbConstraints(): string {
  return [
    'WHITE BALANCE — legal values:',
    `- Kelvin ${span(WB_KELVIN)}, or an auto mode`,
    `- Shift on each axis: ${span(WB_SHIFT_AXIS)}; amber/blue is A or B, green/magenta is G or M`,
  ].join('\n');
}

/** The full brief for one format. */
export function constraintsFor(format: 'pp' | 'cl'): string {
  return [wbConstraints(), format === 'pp' ? ppConstraints() : clConstraints()].join('\n\n');
}
