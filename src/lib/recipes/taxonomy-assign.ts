/**
 * Which taxonomy a recipe carries: the editor's manifest first, the settings'
 * own suggestion where the manifest is silent.
 *
 * `data/recipe-taxonomy.json` is a git-time manifest keyed by recipe id: no
 * content-plane column yet, no admin field, so a recipe an administrator
 * creates on production after
 * this commit still browses — by what `deriveTaxonomy` reads off its numbers —
 * until an editor places it here. A column and an admin control are the next
 * release's job (handoff, "Quyết định cho bản phát hành này").
 *
 * One rule the manifest cannot override: a monochrome recipe is `mono` and a
 * colour recipe is not. That is the one classification the settings state
 * exactly, and `taxonomy.test.ts` fails a manifest entry that disagrees.
 *
 * Separate from `taxonomy.ts` so the header's URL builder, which is a client
 * component, never pulls the JSON into its bundle.
 */

import manifest from '../../../data/recipe-taxonomy.json';
import { WB_KELVIN } from '../camera/constants';
import type { Recipe } from '../camera/schema';
import { recipeIdKey } from './recipe-id';
import {
  deriveTaxonomy,
  isMonochrome,
  parseSituation,
  parseStyle,
  parseTone,
  type RecipeTaxonomy,
  type SituationId,
} from './taxonomy';

export type ManifestEntry = {
  readonly situations?: readonly string[];
  readonly style?: string;
  readonly tone?: string;
  /**
   * The Kelvin of the light the recipe is built for, when it is not daylight
   * — Sài Gòn Café's bulbs, a night market's mixed lamps. An editorial
   * statement about the scene, never a camera value; the palette reads the
   * recipe under it (`paletteFor(r, { light })`).
   */
  readonly light?: number;
};

export const TAXONOMY_MANIFEST = manifest as Readonly<Record<string, ManifestEntry>>;

/* Keyed through `recipeIdKey`, so a recipe read as `PP-001` after the id
   migration finds the entry the manifest still files under `SCL-PP-001`. */
const MANIFEST_BY_KEY: ReadonlyMap<string, ManifestEntry> = new Map(
  Object.entries(TAXONOMY_MANIFEST).map(([id, entry]) => [recipeIdKey(id), entry]),
);

/** The manifest's say on one recipe, validated, with unknown ids dropped. */
function fromManifest(id: string): Partial<RecipeTaxonomy> {
  const entry = MANIFEST_BY_KEY.get(recipeIdKey(id));
  if (!entry) return {};
  const out: { situations?: SituationId[]; style?: RecipeTaxonomy['style']; tone?: RecipeTaxonomy['tone'] } = {};
  if (entry.situations) {
    out.situations = entry.situations
      .map(parseSituation)
      .filter((s): s is SituationId => s !== null);
  }
  const style = parseStyle(entry.style);
  if (style) out.style = style;
  const tone = parseTone(entry.tone);
  if (tone) out.tone = tone;
  return out;
}

/**
 * The tone an editor set for this recipe in the manifest, or null when the
 * manifest leaves it to the settings. An editor sets one where the photographs
 * contradict what the White Balance arithmetic predicts — the shift step's
 * mired value is fitted, not published — so it outranks that estimate.
 */
export function editorialToneFor(id: string): RecipeTaxonomy['tone'] | null {
  return fromManifest(id).tone ?? null;
}

/**
 * The light the recipe is built for, from the manifest, or null for daylight.
 * Outside the camera's own Kelvin range it is ignored: no recipe is built for
 * a light the camera cannot be set to.
 */
export function designedLightFor(id: string): number | null {
  const light = MANIFEST_BY_KEY.get(recipeIdKey(id))?.light;
  return typeof light === 'number' && light >= WB_KELVIN.min && light <= WB_KELVIN.max ? light : null;
}

export function taxonomyFor(recipe: Recipe): RecipeTaxonomy {
  const derived = deriveTaxonomy(recipe);
  const edited = fromManifest(recipe.id);
  const mono = isMonochrome(recipe);
  return {
    situations: edited.situations ?? derived.situations,
    style: edited.style ?? derived.style,
    /* Mono is read off the settings whatever the manifest says; a colour
       recipe takes the editor's tone, or the white balance's. */
    tone: mono ? 'mono' : edited.tone && edited.tone !== 'mono' ? edited.tone : derived.tone,
  };
}
