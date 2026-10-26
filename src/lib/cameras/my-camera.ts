/**
 * "My camera" (ADR 0006): which cameras a reader can pick, what a stored
 * choice means, and what it hides. Pure — the cookie is read by the caller
 * (`cookies()` on the browse page, `document.cookie` in the recipe page's
 * warning island), and the catalogue is passed in.
 *
 * Every rule about what a camera can install is `installability()`'s; this
 * module only connects a reader's choice to it. A choice it does not
 * recognise — a model the catalogue no longer lists, a hand-edited cookie —
 * is no camera, and no camera hides nothing.
 */

import { modelCode } from './aliases';
import {
  capabilitiesForChoice,
  installability,
  type CameraCapabilities,
  type InstallableRecipe,
  type InstallReason,
} from './capabilities/installable';
import { wellFormedChoice } from './my-camera-cookie';

/** The generic choice that hides Creative Look and knows nothing else. */
export const OLDER_CAMERA_CHOICE = 'older-creative-style';
/** The generic choice that is the same as choosing nothing. */
export const UNKNOWN_CAMERA_CHOICE = 'unknown';

/** One catalogue camera, as the picker lists it. */
export type CameraOption = {
  /** The model code its SKU starts with (`ILCE-7M3`): what the cookie stores. */
  readonly id: string;
  /** The short name a reader says: `a7 III`, `ZV-E10`. Never translated. */
  readonly name: string;
  readonly imageUrl: string;
};

/**
 * `7 III` → `a7 III`, `6400` → `a6400`; `ZV-E10`, `FX3`, `RX100 VII` unchanged.
 * The catalogue stores an Alpha body's name without its prefix, and a bare
 * `7 III` in a sentence ("7 III has no Creative Look") does not read as a
 * camera. The `a` goes where `productAliases` adds one: an `ILCE-` body whose
 * name starts with a digit. Latin `a`, not `α`: the self-hosted subsets are
 * Latin and Vietnamese, and a Greek glyph would fall back mid-word.
 */
export function cameraShortName(product: { sku: string; name: string }): string {
  const name = product.name.trim();
  return /^ILCE-/i.test(modelCode(product.sku)) && /^\d/.test(name) ? `a${name}` : name;
}

/** The catalogue's cameras, one per model code, in name order. */
export function cameraOptions(
  products: readonly { sku: string; name: string; category: string; imageUrl: string }[],
): CameraOption[] {
  const byId = new Map<string, CameraOption>();
  for (const p of products) {
    if (p.category !== 'camera') continue;
    const id = modelCode(p.sku);
    if (!id || !wellFormedChoice(id) || byId.has(id)) continue;
    byId.set(id, { id, name: cameraShortName(p), imageUrl: p.imageUrl });
  }
  /* Not `numeric`: that put the a6400 after the a9 III. */
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** The reader's camera, once a stored value has been recognised. */
export type MyCamera = {
  /** A catalogue model code, or `OLDER_CAMERA_CHOICE`. */
  readonly choice: string;
  /** The camera's short name; `null` for the generic older-camera choice. */
  readonly name: string | null;
  readonly caps: CameraCapabilities;
};

/**
 * A stored value to a camera, or `null` for none: unknown, malformed, a model
 * the catalogue does not list, and `unknown` itself all mean no camera.
 */
export function resolveMyCamera(raw: unknown, options: readonly CameraOption[]): MyCamera | null {
  if (!wellFormedChoice(raw) || raw === UNKNOWN_CAMERA_CHOICE) return null;
  if (raw === OLDER_CAMERA_CHOICE) return { choice: raw, name: null, caps: capabilitiesForChoice(raw) };
  const option = options.find((o) => o.id === raw);
  return option ? { choice: option.id, name: option.name, caps: capabilitiesForChoice(option.id) } : null;
}

/** What a value may be stored as: the generic older-camera choice or a listed model. */
export function isStorableChoice(value: unknown, options: readonly CameraOption[]): value is string {
  return resolveMyCamera(value, options) !== null;
}

/** The recipes this camera can install. No camera, or one with no checked data, keeps them all. */
export function installableFor<T extends InstallableRecipe>(recipes: readonly T[], camera: MyCamera | null): T[] {
  if (!camera) return [...recipes];
  return recipes.filter((r) => installability(r, camera.caps).installable);
}

/** One choice's accuracy lines for one recipe. `camera` is `null` for the generic choice. */
export type CameraWarning = { readonly camera: string | null; readonly reasons: readonly InstallReason[] };

/**
 * Every choice that has something to say about this recipe, keyed by the
 * value the cookie would hold. Computed when the recipe page is prerendered,
 * so the page stays static and the browser only looks its cookie up here.
 * A choice with no reasons is left out.
 */
export function cameraWarnings(recipe: InstallableRecipe, options: readonly CameraOption[]): Record<string, CameraWarning> {
  const out: Record<string, CameraWarning> = {};
  const choices: { choice: string; camera: string | null }[] = [
    { choice: OLDER_CAMERA_CHOICE, camera: null },
    ...options.map((o) => ({ choice: o.id, camera: o.name })),
  ];
  for (const { choice, camera } of choices) {
    const { reasons } = installability(recipe, capabilitiesForChoice(choice));
    if (reasons.length > 0) out[choice] = { camera, reasons };
  }
  return out;
}
