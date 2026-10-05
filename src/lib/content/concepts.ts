import {
  CL_PARAM_LABELS,
  PP_PARAM_LABELS,
  WB_PARAM_LABELS,
  type RecipeFormat,
} from '@/lib/camera/constants'
import { CL_EXPLANATIONS, PP_EXPLANATIONS, WB_EXPLANATIONS } from '@/lib/camera/explanations'

/**
 * The closed vocabulary a page uses to say which camera concepts it explains.
 *
 * Generated from the explanation tables rather than typed out, so it cannot
 * name a parameter the app does not have, and a parameter cannot be added
 * without becoming linkable: `explanations.test.ts` already fails if a
 * parameter loses its explanation, and every explained parameter is a concept.
 *
 * The key is what an article stores in `meta.concepts`. A recipe page asks
 * "which published pages explain a concept this recipe uses?" with
 * `conceptsForRecipe()`, which is how the reverse link from a recipe's
 * parameter table to the reference that explains it is computed without
 * anyone authoring it.
 */

type WbKey = keyof typeof WB_EXPLANATIONS
type PpKey = keyof typeof PP_EXPLANATIONS
type ClKey = keyof typeof CL_EXPLANATIONS

export type ConceptGroup = 'wb' | 'pp' | 'cl'

export type ConceptKey =
  | ConceptGroup
  | 'cl.look'
  | `wb.${WbKey}`
  | `pp.${PpKey}`
  | `cl.${ClKey}`

export type Concept = {
  readonly key: ConceptKey
  readonly group: ConceptGroup
  /** Technical name, never translated (Rule 3). */
  readonly label: string
}

/** The group names are product terms, the same category as a Look code. */
export const CONCEPT_GROUP_LABELS: Readonly<Record<ConceptGroup, string>> = {
  wb: 'White Balance',
  pp: 'Picture Profile',
  cl: 'Creative Look',
}

const keysOf = <T extends object>(o: T) => Object.keys(o) as (keyof T & string)[]

export const CONCEPTS: readonly Concept[] = [
  { key: 'wb', group: 'wb', label: CONCEPT_GROUP_LABELS.wb },
  ...keysOf(WB_EXPLANATIONS).map(
    (k): Concept => ({ key: `wb.${k}`, group: 'wb', label: WB_PARAM_LABELS[k] }),
  ),
  { key: 'pp', group: 'pp', label: CONCEPT_GROUP_LABELS.pp },
  ...keysOf(PP_EXPLANATIONS).map(
    (k): Concept => ({ key: `pp.${k}`, group: 'pp', label: PP_PARAM_LABELS[k] }),
  ),
  { key: 'cl', group: 'cl', label: CONCEPT_GROUP_LABELS.cl },
  { key: 'cl.look', group: 'cl', label: 'Look' },
  ...keysOf(CL_EXPLANATIONS).map(
    (k): Concept => ({ key: `cl.${k}`, group: 'cl', label: CL_PARAM_LABELS[k] }),
  ),
]

const BY_KEY: ReadonlyMap<string, Concept> = new Map(CONCEPTS.map((c) => [c.key, c]))

export function isConceptKey(raw: unknown): raw is ConceptKey {
  return typeof raw === 'string' && BY_KEY.has(raw)
}

export function conceptByKey(key: ConceptKey): Concept {
  return BY_KEY.get(key) as Concept
}

/** "Picture Profile · Color Depth", or just the group name for a group key. */
export function conceptTitle(key: ConceptKey): string {
  const c = conceptByKey(key)
  const group = CONCEPT_GROUP_LABELS[c.group]
  return c.key === c.group ? group : `${group} · ${c.label}`
}

/**
 * Every concept a recipe of this format exercises: White Balance and its
 * three dials always — both formats share all of it (Rule 1b) — plus the
 * format and each of its parameters.
 */
export function conceptsForRecipe(format: RecipeFormat): readonly ConceptKey[] {
  return CONCEPTS.filter((c) => c.group === 'wb' || c.group === format).map((c) => c.key)
}
