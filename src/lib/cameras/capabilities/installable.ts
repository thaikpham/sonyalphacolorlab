/**
 * Can this reader's camera install this recipe? The rules of ADR 0006, as a
 * pure function of the checked evidence — no I/O, so the browse page can run
 * it over the whole catalogue after one unfiltered `listRecipes(locale)`.
 *
 * Unknown is never "no". Every field below is `null` until a checked claim
 * settles it, and a `null` hides nothing:
 *
 * - a Creative Look recipe is hidden only when the camera is confirmed to
 *   lack Creative Look;
 * - a Picture Profile recipe is hidden only when the camera is confirmed to
 *   lack Picture Profile, or the recipe's Gamma or Color Mode is outside the
 *   camera's confirmed list;
 * - a camera with no checked data shows everything.
 *
 * **Creative Style means no Creative Look.** No Help Guide topic read says
 * "this body has no Creative Look" in words, and none prints a menu list it
 * would be absent from. What a page does say is that the body's style menu is
 * `[Creative Style]` — the menu Creative Look replaced. The owner's rule
 * (P4 brief, 2026-10-23) is that a body confirmed to be on Creative Style is
 * treated as confirmed to lack Creative Look. That inference lives here and
 * nowhere else; `evidence.ts` only records what the page says.
 *
 * **Spelling.** Gamma and Color Mode values are `constants.ts` spellings
 * (`PP_GAMMA`, `PP_COLOR_MODE`), the same strings a recipe stores. They are
 * bound to Sony's page text by `GAMMA_LITERAL` / `COLOR_MODE_LITERAL` in
 * `evidence.ts`, keyed by the constant and quoting the page. On every body
 * read, each option prints exactly as `constants.ts` spells it, followed by a
 * colon — `ITU709(800%):`, `S-Gamut3.Cine:`, `Black & White:` once the page
 * reader has decoded `&amp;` — so no bridge is needed beyond those tables. The
 * one family where Sony's words and the constants differ is White Balance's
 * auto modes (`AWB (Priority White)` is the page's `Auto: White`, Rule 1b);
 * the filter does not read it.
 */

import { FORMAT_LABELS, PP_COLOR_MODE, PP_GAMMA } from '@/lib/camera/constants'
import type { PpSettings } from '@/lib/camera/schema'
import type { ConfirmedClaim } from './checks'
import { EVIDENCE_SOURCES } from './evidence'
import { capabilitiesOf } from './index'
import type { CapabilityKey, PpColorMode, PpGamma } from './keys'

/** What is known about one camera. `null`: unknown, which never hides a recipe. */
export type CameraCapabilities = {
  readonly creativeLook: boolean | null
  readonly pictureProfile: boolean | null
  /** The camera's complete Gamma list, or `null` when any option is unsettled. */
  readonly gammas: readonly PpGamma[] | null
  /** The camera's complete Color Mode list, or `null` when any option is unsettled. */
  readonly colorModes: readonly PpColorMode[] | null
  /**
   * Options this choice may lack, unconfirmed. Only the generic older-camera
   * choice carries any: a warning line, never a reason to hide.
   */
  readonly mayLack?: { readonly gammas: readonly PpGamma[]; readonly colorModes: readonly PpColorMode[] }
}

/** "Unknown / skip": nothing is known, so everything shows. */
export const UNKNOWN_CAMERA: CameraCapabilities = {
  creativeLook: null,
  pictureProfile: null,
  gammas: null,
  colorModes: null,
}

/** The two choices a reader can make without naming a catalogue camera. */
export const GENERIC_CAMERA_CHOICES = ['older-creative-style', 'unknown'] as const
export type GenericCameraChoice = (typeof GENERIC_CAMERA_CHOICES)[number]

export function isGenericCameraChoice(value: string): value is GenericCameraChoice {
  return (GENERIC_CAMERA_CHOICES as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// From claims to capabilities
// ---------------------------------------------------------------------------

type Settled = 'yes' | 'no' | null

/**
 * One key's verdict, mode set aside: the filter answers "can this body
 * install it at all", so a support in any mode is a yes, and a no needs a
 * confirmed refusal with no support beside it.
 */
function settled(byKey: ReadonlyMap<CapabilityKey, readonly ConfirmedClaim[]>, key: CapabilityKey): Settled {
  const claims = byKey.get(key) ?? []
  if (claims.some((c) => c.status === 'supported')) return 'yes'
  if (claims.some((c) => c.status === 'unsupported')) return 'no'
  return null
}

function asBoolean(s: Settled): boolean | null {
  return s === null ? null : s === 'yes'
}

/** A complete list, or `null` when any option `constants.ts` knows is unsettled. */
function completeList<T extends string>(
  byKey: ReadonlyMap<CapabilityKey, readonly ConfirmedClaim[]>,
  options: readonly T[],
  key: (option: T) => CapabilityKey,
): readonly T[] | null {
  const verdicts = options.map((o) => [o, settled(byKey, key(o))] as const)
  if (verdicts.some(([, v]) => v === null)) return null
  return verdicts.filter(([, v]) => v === 'yes').map(([o]) => o)
}

/** Pure: the capabilities one body's confirmed claims establish. */
export function capabilitiesFromClaims(byKey: ReadonlyMap<CapabilityKey, readonly ConfirmedClaim[]>): CameraCapabilities {
  const look = settled(byKey, 'creative-look')
  const style = settled(byKey, 'creative-style')
  return {
    /* A Creative Look support outranks the Creative Style inference. */
    creativeLook: look !== null ? look === 'yes' : style === 'yes' ? false : null,
    pictureProfile: asBoolean(settled(byKey, 'picture-profile')),
    gammas: completeList(byKey, PP_GAMMA, (g) => `pp.gamma:${g}`),
    colorModes: completeList(byKey, PP_COLOR_MODE, (m) => `pp.colorMode:${m}`),
  }
}

/** The bodies the evidence names, by model code (`ILCE-7M3`, `ZV-1`). */
export const EVIDENCED_MODELS: readonly string[] = [...new Set(EVIDENCE_SOURCES.map((s) => s.camera))]

const BY_MODEL: ReadonlyMap<string, CameraCapabilities> = new Map(
  EVIDENCED_MODELS.map((m) => [m, capabilitiesFromClaims(capabilitiesOf(m))]),
)

/** One catalogue camera, by the model code its SKU starts with. Unknown for any body without checked claims. */
export function capabilitiesForModel(model: string): CameraCapabilities {
  return BY_MODEL.get(model) ?? UNKNOWN_CAMERA
}

/**
 * Options every checked Creative Style body's complete list lacks — what the
 * generic older-camera choice may lack. Derived, not typed: a checked body
 * that has the option drops it from here. Two or eight bodies do not prove it
 * of every older body, which is why it only ever warns.
 */
function lackedByEveryCreativeStyleBody<T extends string>(
  options: readonly T[],
  list: (c: CameraCapabilities) => readonly T[] | null,
): readonly T[] {
  const lists = [...BY_MODEL.values()]
    .filter((c) => c.creativeLook === false)
    .map(list)
    .filter((l): l is readonly T[] => l !== null)
  if (lists.length === 0) return []
  return options.filter((o) => lists.every((l) => !l.includes(o)))
}

/**
 * "Older camera, Creative Style menu": Creative Look is hidden by the owner's
 * rule; everything else is unknown, with a warning for what no checked
 * Creative Style body has.
 */
export const OLDER_CREATIVE_STYLE_CAMERA: CameraCapabilities = {
  creativeLook: false,
  pictureProfile: null,
  gammas: null,
  colorModes: null,
  mayLack: {
    gammas: lackedByEveryCreativeStyleBody(PP_GAMMA, (c) => c.gammas),
    colorModes: lackedByEveryCreativeStyleBody(PP_COLOR_MODE, (c) => c.colorModes),
  },
}

/** A stored choice — a model code or a generic id — to capabilities. Anything unrecognised is unknown. */
export function capabilitiesForChoice(choice: string | null | undefined): CameraCapabilities {
  if (!choice || choice === 'unknown') return UNKNOWN_CAMERA
  if (choice === 'older-creative-style') return OLDER_CREATIVE_STYLE_CAMERA
  return capabilitiesForModel(choice)
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

/**
 * Why a recipe may not install: renderable as one accuracy line,
 * "{camera} has no {label}". The UI renders it through `messages/`; `label`
 * is Sony's own name and is never translated (Rule 3).
 */
export type InstallReason = {
  readonly setting: 'creativeLook' | 'pictureProfile' | 'gamma' | 'colorMode'
  /** `Creative Look`, `Picture Profile`, or the Gamma / Color Mode value: `S-Cinetone`. */
  readonly label: string
  /** `true`: confirmed missing, and the recipe is hidden. `false`: unconfirmed, a warning only. */
  readonly confirmed: boolean
}

export type Installability = {
  /** `false` only when a reason is confirmed. */
  readonly installable: boolean
  /** One per missing name: an S-Cinetone gamma and colour mode make one reason, the Gamma's. */
  readonly reasons: readonly InstallReason[]
}

/** What `installability` reads of a recipe — any `Recipe` fits. */
export type InstallableRecipe =
  | { readonly format: 'cl' }
  | { readonly format: 'pp'; readonly settings: Pick<PpSettings, 'gamma' | 'colorMode'> }

export function installability(recipe: InstallableRecipe, caps: CameraCapabilities): Installability {
  const reasons: InstallReason[] = []
  const add = (r: InstallReason) => {
    if (!reasons.some((x) => x.label === r.label)) reasons.push(r)
  }

  if (recipe.format === 'cl') {
    if (caps.creativeLook === false) add({ setting: 'creativeLook', label: FORMAT_LABELS.cl, confirmed: true })
  } else if (caps.pictureProfile === false) {
    add({ setting: 'pictureProfile', label: FORMAT_LABELS.pp, confirmed: true })
  } else {
    const { gamma, colorMode } = recipe.settings
    if (caps.gammas && !caps.gammas.includes(gamma)) add({ setting: 'gamma', label: gamma, confirmed: true })
    if (caps.colorModes && !caps.colorModes.includes(colorMode)) add({ setting: 'colorMode', label: colorMode, confirmed: true })
    if (!caps.gammas && caps.mayLack?.gammas.includes(gamma)) add({ setting: 'gamma', label: gamma, confirmed: false })
    if (!caps.colorModes && caps.mayLack?.colorModes.includes(colorMode)) add({ setting: 'colorMode', label: colorMode, confirmed: false })
  }

  return { installable: !reasons.some((r) => r.confirmed), reasons }
}
