/**
 * Which taxonomy a recipe carries: the editor's manifest first, the settings'
 * own suggestion where the manifest is silent.
 *
 * `data/recipe-taxonomy.json` is a git-time manifest keyed by recipe id, the
 * same shape of thing as `data/images.seed.json`: no content-plane column yet,
 * no admin field, so a recipe an administrator creates on production after
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
import type { Recipe } from '../camera/schema';
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
};

export const TAXONOMY_MANIFEST = manifest as Readonly<Record<string, ManifestEntry>>;

/** The manifest's say on one recipe, validated, with unknown ids dropped. */
function fromManifest(id: string): Partial<RecipeTaxonomy> {
  const entry = TAXONOMY_MANIFEST[id];
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
