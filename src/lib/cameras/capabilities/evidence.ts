/**
 * What Sony's Help Guide says each pilot body has — written by reading the
 * raw pages, and counted only once a check of the live page finds it.
 *
 * Each source is one Help Guide topic for one body. Each claim names a
 * capability key and quotes a short literal from that topic. A claim counts
 * when `npm run capabilities:check` has fetched the page, read the topic the
 * way `page-text.ts` does, and found every literal (`checks.ts`); until then
 * the camera page does not list it for that body. A claim's literal is the evidence,
 * not a label: change the claim and it stops counting until the page is
 * checked again.
 *
 * Rules the claims follow, and `evidence.test.ts` holds them to:
 *
 * - **Quote the option with the start of its description**, not its bare
 *   name. `Movie` is both a Gamma and a Color Mode; `Daylight` is inside
 *   `Fluor.: Daylight`. The literal is what binds a claim to the right list.
 * - **A support with a known exception states its mode.** Sharpness Range is
 *   supported for stills and refused in movie mode, so the support claim says
 *   `photo` rather than inheriting the topic's still/movie scope. If the
 *   exception's literal ever stops matching, the camera page keeps it under
 *   stills only — never widens it to both modes.
 * - **`unsupported` needs Sony's words or a whole list.** Either a sentence
 *   that refuses it ("… cannot be adjusted"), or an `absentFrom` list: the
 *   body's complete option list, bounded by the literals before and after it,
 *   with the option not in it. A list whose bounds are not found proves
 *   nothing and is never read as absence.
 * - **Names, never numbers.** A claim says a body has an option, not what
 *   values it accepts. None of these topics states a Kelvin range, a shift
 *   limit or a step, and the camera page says so rather than borrowing the
 *   global ones in `constants.ts` (WB_KELVIN and WB_SHIFT_AXIS).
 *
 * Read 2026-10-05: ILCE-7M4, ILCE-7CM2, ILCE-6700, ILCE-7M5 — the Creative
 * Look, White Balance and Picture Profile topics of each; for ILCE-7M4 and
 * ILCE-7M5 also the complete guide in print, which is how "no Kelvin range
 * anywhere" and "no Color Depth item anywhere" were established.
 */

import { CREATIVE_LOOKS, type ClParam, type PpColorMode, type PpGamma } from '@/lib/camera/constants'
import type { CapabilityKey, PpMenuItem, WbPreset } from './keys'

export type ModeScope = 'photo' | 'video' | 'both'
export type ShootingMode = 'photo' | 'video'

export type Claim = {
  readonly capability: CapabilityKey
  readonly status: 'supported' | 'unsupported'
  /** Overrides the topic's scope. Required on a support that has a known exception. */
  readonly mode?: ModeScope
  /** Literals that must all be found in the topic for the claim to count. */
  readonly match: readonly string[]
  /** For `unsupported` only: the body's whole option list, and the option missing from it. */
  readonly absentFrom?: { readonly after: string; readonly before: string; readonly literal: string }
}

export type EvidenceSource = {
  /** `<model>/<topic>`, stable — the checks file is keyed by it. */
  readonly id: string
  /** Model code as the catalogue's SKU starts: `ILCE-7M4`. */
  readonly camera: string
  readonly url: string
  /** The topic's heading as the page prints it — the check refuses any other page. */
  readonly topic: string
  /** What the heading's "(still image/movie)" says. */
  readonly scope: ModeScope
  readonly claims: readonly Claim[]
}

// ---------------------------------------------------------------------------
// Literals — the same wording on every pilot body's topic
// ---------------------------------------------------------------------------

const PP_ITEM_LITERAL: Record<PpMenuItem, string> = {
  'Black Level': 'Black Level Sets the black level.',
  Gamma: 'Gamma Selects a gamma curve.',
  'Black Gamma': 'Black Gamma Corrects gamma in low intensity areas.',
  Knee: 'Knee Sets knee point and slope',
  'Color Mode': 'Color Mode Sets type and level of colors.',
  Saturation: 'Saturation Sets the color saturation.',
  'Color Phase': 'Color Phase Sets the color phase.',
  'Color Depth': 'Color Depth Sets the color depth for each color phase.',
  Detail: 'Detail Sets items for [Detail].',
}

const GAMMA_LITERAL: Partial<Record<PpGamma, string>> = {
  Movie: 'Movie: Standard gamma curve for movies',
  Still: 'Still: Standard gamma curve for still images',
  'S-Cinetone': 'S-Cinetone: Gamma curve designed to achieve cinematic',
  Cine1: 'Cine1: Softens the contrast in dark parts',
  Cine2: 'Cine2: Similar to [Cine1]',
  Cine3: 'Cine3: Intensifies the contrast',
  Cine4: 'Cine4: Strengthens the contrast in dark parts',
  ITU709: 'ITU709: Gamma curve that corresponds to ITU709',
  'ITU709(800%)': 'ITU709(800%): Gamma curve for confirming scenes',
  'S-Log2': 'S-Log2: Gamma curve for [S-Log2]',
  'S-Log3': 'S-Log3: Gamma curve for [S-Log3]',
  HLG: 'HLG: Gamma curve for HDR recording',
  HLG1: 'HLG1: Gamma curve for HDR recording',
  HLG2: 'HLG2: Gamma curve for HDR recording',
  HLG3: 'HLG3: Gamma curve for HDR recording',
}

const COLOR_MODE_LITERAL: Partial<Record<PpColorMode, string>> = {
  Movie: 'Movie: Suitable colors when [Gamma] is set to [Movie]',
  Still: 'Still: Suitable colors when [Gamma] is set to [Still]',
  'S-Cinetone': 'S-Cinetone: Suitable colors when [Gamma] is set to [S-Cinetone]',
  Cinema: 'Cinema: Suitable colors when [Gamma] is set to [Cine1]',
  Pro: 'Pro: Similar color tones to the standard image quality',
  'ITU709 Matrix': 'ITU709 Matrix: Colors corresponding to ITU709 standard',
  'Black & White': 'Black & White: Sets the saturation to zero',
  'S-Gamut': 'S-Gamut: Setting based on the assumption',
  'S-Gamut3': 'S-Gamut3: Setting based on the assumption',
  'S-Gamut3.Cine': 'S-Gamut3.Cine: Setting based on the assumption',
  'BT.2020': 'BT.2020: Standard color tone when [Gamma] is set',
  '709': '709: Color tone when [Gamma] is set to [HLG]',
}

/** The complete lists on a Picture Profile topic, by the text either side of them. */
const ITEM_LIST = { after: 'Items of the picture profile', before: 'To copy the settings to another picture profile number' }
const GAMMA_LIST = { after: PP_ITEM_LITERAL.Gamma, before: PP_ITEM_LITERAL['Black Gamma'] }
const COLOR_MODE_LIST = { after: PP_ITEM_LITERAL['Color Mode'], before: PP_ITEM_LITERAL.Saturation }

const CL_ADJUST_LITERAL: Record<ClParam, string> = {
  contrast: 'Contrast: The higher the value selected',
  highlights: 'Highlights: Adjusts the brightness of the bright areas',
  shadows: 'Shadows: Adjusts the darkness of the dark areas',
  fade: 'Fade: Adjusts the degree of fade',
  saturation: 'Saturation: The higher the value selected, the more vivid the color',
  sharpness: 'Sharpness: Adjusts the sharpness',
  sharpnessRange: 'Sharpness Range: Adjust the range where the sharpness effect is applied',
  clarity: 'Clarity: Adjusts the degree of clarity',
}

const SHARPNESS_RANGE_MOVIE = 'In the movie mode, [Sharpness Range] cannot be adjusted.'

/** White Balance's option list prints as one run: `Auto / Auto: Ambience / … / Underwater Auto:`. */
const WB_PRESET_LITERAL: Record<WbPreset, string> = {
  Daylight: '/ Daylight /',
  Shade: '/ Shade /',
  Cloudy: '/ Cloudy /',
  Incandescent: '/ Incandescent /',
  'Fluor.: Warm White': '/ Fluor.: Warm White /',
  'Fluor.: Cool White': '/ Fluor.: Cool White /',
  'Fluor.: Day White': '/ Fluor.: Day White /',
  'Fluor.: Daylight': '/ Fluor.: Daylight /',
  Flash: '/ Flash (only when shooting still images) /',
  'Underwater Auto': '/ Underwater Auto:',
}

// ---------------------------------------------------------------------------
// Claim builders — one topic shape each
// ---------------------------------------------------------------------------

/**
 * A Creative Look topic. `looks` is how this page prints a Look: `ST(Standard):`
 * on most bodies, bare `ST:` on the ILCE-6700.
 */
function creativeLookClaims(looks: 'code-and-name' | 'code'): Claim[] {
  const claims: Claim[] = [
    { capability: 'creative-look', status: 'supported', match: ['[Color/Tone] → [Creative Look]'] },
  ]
  for (const look of CREATIVE_LOOKS) {
    const literal = looks === 'code-and-name' ? `${look.code}(${look.label}):` : `${look.code}:`
    claims.push({ capability: `cl.look:${look.code}`, status: 'supported', match: [literal] })
  }
  for (const [param, literal] of Object.entries(CL_ADJUST_LITERAL) as [ClParam, string][]) {
    if (param === 'sharpnessRange') {
      claims.push(
        { capability: 'cl.adjust:sharpnessRange', status: 'supported', mode: 'photo', match: [literal] },
        { capability: 'cl.adjust:sharpnessRange', status: 'unsupported', mode: 'video', match: [SHARPNESS_RANGE_MOVIE] },
      )
    } else {
      claims.push({ capability: `cl.adjust:${param}`, status: 'supported', match: [literal] })
    }
  }
  return claims
}

/** A White Balance topic; identical wording on all four pilot bodies. */
function whiteBalanceClaims(): Claim[] {
  const claims: Claim[] = [
    { capability: 'wb.auto:AWB', status: 'supported', match: ['Menu item details Auto /'] },
    { capability: 'wb.auto:AWB (Priority Ambience)', status: 'supported', match: ['/ Auto: Ambience /'] },
    { capability: 'wb.auto:AWB (Priority White)', status: 'supported', match: ['/ Auto: White /'] },
    /* No range: the topic names [C.Temp./Filter] and prints no Kelvin numbers. */
    {
      capability: 'wb.kelvin',
      status: 'supported',
      match: ['C.Temp./Filter: Adjusts the color tones depending on the light source'],
    },
  ]
  for (const [preset, literal] of Object.entries(WB_PRESET_LITERAL) as [WbPreset, string][]) {
    if (preset === 'Flash') {
      /* "(only when shooting still images)" is both halves of the fact. */
      claims.push(
        { capability: 'wb.preset:Flash', status: 'supported', mode: 'photo', match: [literal] },
        { capability: 'wb.preset:Flash', status: 'unsupported', mode: 'video', match: [literal] },
      )
    } else {
      claims.push({ capability: `wb.preset:${preset}`, status: 'supported', match: [literal] })
    }
  }
  return claims
}

/**
 * A Picture Profile topic. `items`, `gammas` and `colorModes` are this body's
 * complete lists as its page prints them; everything else `constants.ts`
 * knows is claimed absent from the list it would be in.
 */
function pictureProfileClaims(
  items: readonly PpMenuItem[],
  gammas: readonly PpGamma[],
  colorModes: readonly PpColorMode[],
): Claim[] {
  const claims: Claim[] = [
    { capability: 'picture-profile', status: 'supported', match: ['[Color/Tone] → [Picture Profile]'] },
  ]
  for (const [item, literal] of Object.entries(PP_ITEM_LITERAL) as [PpMenuItem, string][]) {
    claims.push(
      items.includes(item)
        ? { capability: `pp.item:${item}`, status: 'supported', match: [literal] }
        : { capability: `pp.item:${item}`, status: 'unsupported', match: [], absentFrom: { ...ITEM_LIST, literal: item } },
    )
  }
  for (const [gamma, literal] of Object.entries(GAMMA_LITERAL) as [PpGamma, string][]) {
    claims.push(
      gammas.includes(gamma)
        ? { capability: `pp.gamma:${gamma}`, status: 'supported', match: [literal] }
        : { capability: `pp.gamma:${gamma}`, status: 'unsupported', match: [], absentFrom: { ...GAMMA_LIST, literal: `${gamma}:` } },
    )
  }
  for (const [mode, literal] of Object.entries(COLOR_MODE_LITERAL) as [PpColorMode, string][]) {
    claims.push(
      colorModes.includes(mode)
        ? { capability: `pp.colorMode:${mode}`, status: 'supported', match: [literal] }
        : { capability: `pp.colorMode:${mode}`, status: 'unsupported', match: [], absentFrom: { ...COLOR_MODE_LIST, literal: `${mode}:` } },
    )
  }
  /* `709tone` is in the generic Picture Profile guide and on no pilot body. */
  claims.push({
    capability: 'pp.colorMode:709tone',
    status: 'unsupported',
    match: [],
    absentFrom: { ...COLOR_MODE_LIST, literal: '709tone:' },
  })
  return claims
}

const ALL_ITEMS = Object.keys(PP_ITEM_LITERAL) as PpMenuItem[]
/** ILCE-7M5's item list goes Color Phase → Detail; the whole guide never names a Color Depth item. */
const ITEMS_WITHOUT_COLOR_DEPTH = ALL_ITEMS.filter((i) => i !== 'Color Depth')
const ALL_GAMMAS = Object.keys(GAMMA_LITERAL) as PpGamma[]
const ALL_COLOR_MODES = Object.keys(COLOR_MODE_LITERAL) as PpColorMode[]
/** The current bodies print neither `S-Log2` nor `ITU709(800%)`, nor the `S-Gamut` it pairs with. */
const CURRENT_GAMMAS = ALL_GAMMAS.filter((g) => g !== 'S-Log2' && g !== 'ITU709(800%)')
const CURRENT_COLOR_MODES = ALL_COLOR_MODES.filter((m) => m !== 'S-Gamut')

const STILL_MOVIE = (topic: string) => `${topic} (still image/movie)`

export const EVIDENCE_SOURCES: readonly EvidenceSource[] = [
  // ILCE-7M4 — the older page template (TP… ids)
  {
    id: 'ILCE-7M4/creative-look',
    camera: 'ILCE-7M4',
    url: 'https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000640837.html',
    topic: STILL_MOVIE('Creative Look'),
    scope: 'both',
    claims: creativeLookClaims('code-and-name'),
  },
  {
    id: 'ILCE-7M4/white-balance',
    camera: 'ILCE-7M4',
    url: 'https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000640840.html',
    topic: STILL_MOVIE('White Balance'),
    scope: 'both',
    claims: whiteBalanceClaims(),
  },
  {
    id: 'ILCE-7M4/picture-profile',
    camera: 'ILCE-7M4',
    url: 'https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000649066.html',
    topic: STILL_MOVIE('Picture Profile'),
    scope: 'both',
    claims: pictureProfileClaims(ALL_ITEMS, ALL_GAMMAS, ALL_COLOR_MODES),
  },
  // ILCE-7CM2
  {
    id: 'ILCE-7CM2/creative-look',
    camera: 'ILCE-7CM2',
    url: 'https://helpguide.sony.net/ilc/2360/v1/en/contents/0411B_creative_look.html',
    topic: STILL_MOVIE('Creative Look'),
    scope: 'both',
    claims: creativeLookClaims('code-and-name'),
  },
  {
    id: 'ILCE-7CM2/white-balance',
    camera: 'ILCE-7CM2',
    url: 'https://helpguide.sony.net/ilc/2360/v1/en/contents/0410C_white_balance.html',
    topic: STILL_MOVIE('White Balance'),
    scope: 'both',
    claims: whiteBalanceClaims(),
  },
  {
    id: 'ILCE-7CM2/picture-profile',
    camera: 'ILCE-7CM2',
    url: 'https://helpguide.sony.net/ilc/2360/v1/en/contents/0412D_picture_profile.html',
    topic: STILL_MOVIE('Picture Profile'),
    scope: 'both',
    claims: pictureProfileClaims(ALL_ITEMS, CURRENT_GAMMAS, CURRENT_COLOR_MODES),
  },
  // ILCE-6700
  {
    id: 'ILCE-6700/creative-look',
    camera: 'ILCE-6700',
    url: 'https://helpguide.sony.net/ilc/2320/v1/en/contents/0411B_creative_look.html',
    topic: STILL_MOVIE('Creative Look'),
    scope: 'both',
    claims: creativeLookClaims('code'),
  },
  {
    id: 'ILCE-6700/white-balance',
    camera: 'ILCE-6700',
    url: 'https://helpguide.sony.net/ilc/2320/v1/en/contents/0410C_white_balance.html',
    topic: STILL_MOVIE('White Balance'),
    scope: 'both',
    claims: whiteBalanceClaims(),
  },
  {
    id: 'ILCE-6700/picture-profile',
    camera: 'ILCE-6700',
    url: 'https://helpguide.sony.net/ilc/2320/v1/en/contents/0412D_picture_profile.html',
    topic: STILL_MOVIE('Picture Profile'),
    scope: 'both',
    claims: pictureProfileClaims(ALL_ITEMS, CURRENT_GAMMAS, CURRENT_COLOR_MODES),
  },
  // ILCE-7M5 — its Creative Look also lists FL2 and FL3, which `constants.ts`
  // does not hold yet (a sync-camera-constants change), so no key and no claim;
  // its Picture Profile has no Color Depth item.
  {
    id: 'ILCE-7M5/creative-look',
    camera: 'ILCE-7M5',
    url: 'https://helpguide.sony.net/ilc/2540/v1/en/contents/0411B_creative_look.html',
    topic: STILL_MOVIE('Creative Look'),
    scope: 'both',
    claims: creativeLookClaims('code-and-name'),
  },
  {
    id: 'ILCE-7M5/white-balance',
    camera: 'ILCE-7M5',
    url: 'https://helpguide.sony.net/ilc/2540/v1/en/contents/0410C_white_balance.html',
    topic: STILL_MOVIE('White Balance'),
    scope: 'both',
    claims: whiteBalanceClaims(),
  },
  {
    id: 'ILCE-7M5/picture-profile',
    camera: 'ILCE-7M5',
    url: 'https://helpguide.sony.net/ilc/2540/v1/en/contents/0412D_picture_profile.html',
    topic: STILL_MOVIE('Picture Profile'),
    scope: 'both',
    claims: pictureProfileClaims(ITEMS_WITHOUT_COLOR_DEPTH, CURRENT_GAMMAS, CURRENT_COLOR_MODES),
  },
]
