import {
  CL_PARAM_LABELS,
  CL_PARAM_ORDER,
  CREATIVE_LOOKS,
  HELP_GUIDE_SOURCES,
  PP_COLOR_DEPTH_CHANNELS,
  PP_DETAIL_LABELS,
  PP_PARAM_LABELS,
  WB_PARAM_LABELS,
} from '@/lib/camera/constants'
import {
  CL_EXPLANATIONS,
  COLOR_DEPTH_EXPLANATIONS,
  PP_DETAIL_EXPLANATIONS,
  PP_EXPLANATIONS,
  WB_EXPLANATIONS,
  WB_OVERVIEW,
  type Locale,
} from '@/lib/camera/explanations'
import { CONCEPT_GROUP_LABELS, type ConceptGroup, type ConceptKey } from '@/lib/content/concepts'

/**
 * `/learn/glossary`, as data.
 *
 * Generated, not authored: every entry is a parameter the recipe tables
 * already explain, with the same text in the same two languages. That is the
 * point of it. The glossary introduces no claim the site does not already
 * make, so it needs no review cycle of its own, it cannot drift from the
 * parameter rows, and a parameter added to `explanations.ts` appears here
 * without anyone remembering to add it.
 *
 * Labels are the technical names from `constants.ts` and are never
 * translated (Rule 3); only the explanation follows the locale. The sources
 * are the help-guide pages `constants.ts` cites for the ranges — named as the
 * reference for the parameter, not as the author of every sentence.
 */

export type GlossaryEntry = {
  /** The `#` target. Stable: recipe pages and search link to it. */
  readonly id: string
  readonly concept?: ConceptKey
  /** Technical name, e.g. `Color Depth` or `R`. */
  readonly label: string
  /** The parameter this one sits under, e.g. `Color Depth` for `R`. */
  readonly parent?: string
  readonly text: string
}

export type GlossaryGroup = {
  readonly group: ConceptGroup
  readonly title: string
  /** WB only: the paragraphs that explain the dials together. */
  readonly overview: readonly string[]
  readonly entries: readonly GlossaryEntry[]
  /** Creative Look only: the ten Looks, code and name. Data, not prose. */
  readonly looks?: readonly { readonly code: string; readonly label: string }[]
  readonly sources: readonly { readonly url: string; readonly title: string }[]
}

/** `pp.colorDepth` → `pp-colorDepth`: the anchor a concept links to. */
export function conceptAnchor(key: ConceptKey): string {
  return key.replace('.', '-')
}

const keysOf = <T extends object>(o: T) => Object.keys(o) as (keyof T & string)[]

export function buildGlossary(locale: Locale): readonly GlossaryGroup[] {
  const wb: GlossaryGroup = {
    group: 'wb',
    title: CONCEPT_GROUP_LABELS.wb,
    overview: WB_OVERVIEW[locale],
    entries: keysOf(WB_EXPLANATIONS).map((k) => ({
      id: conceptAnchor(`wb.${k}`),
      concept: `wb.${k}`,
      label: WB_PARAM_LABELS[k],
      text: WB_EXPLANATIONS[k][locale],
    })),
    sources: [HELP_GUIDE_SOURCES.wbIlce7m4],
  }

  const ppEntries: GlossaryEntry[] = []
  for (const k of keysOf(PP_EXPLANATIONS)) {
    ppEntries.push({
      id: conceptAnchor(`pp.${k}`),
      concept: `pp.${k}`,
      label: PP_PARAM_LABELS[k],
      text: PP_EXPLANATIONS[k][locale],
    })
    /* The two parameters with sub-items list them right under themselves, in
       the order the recipe tables print them. */
    if (k === 'colorDepth') {
      for (const c of PP_COLOR_DEPTH_CHANNELS) {
        ppEntries.push({
          id: `pp-colorDepth-${c}`,
          label: c,
          parent: PP_PARAM_LABELS.colorDepth,
          text: COLOR_DEPTH_EXPLANATIONS[c][locale],
        })
      }
    }
    if (k === 'detail') {
      for (const d of keysOf(PP_DETAIL_EXPLANATIONS)) {
        ppEntries.push({
          id: `pp-detail-${d}`,
          label: PP_DETAIL_LABELS[d],
          parent: PP_PARAM_LABELS.detail,
          text: PP_DETAIL_EXPLANATIONS[d][locale],
        })
      }
    }
  }

  const pp: GlossaryGroup = {
    group: 'pp',
    title: CONCEPT_GROUP_LABELS.pp,
    overview: [],
    entries: ppEntries,
    sources: [
      HELP_GUIDE_SOURCES.ppGammaColorMode,
      HELP_GUIDE_SOURCES.ppBlackKnee,
      HELP_GUIDE_SOURCES.ppColor,
      HELP_GUIDE_SOURCES.ppDetail,
    ],
  }

  const cl: GlossaryGroup = {
    group: 'cl',
    title: CONCEPT_GROUP_LABELS.cl,
    overview: [],
    entries: CL_PARAM_ORDER.map((p) => ({
      id: conceptAnchor(`cl.${p}`),
      concept: `cl.${p}` as ConceptKey,
      label: CL_PARAM_LABELS[p],
      text: CL_EXPLANATIONS[p][locale],
    })),
    looks: CREATIVE_LOOKS.map((l) => ({ code: l.code, label: l.label })),
    sources: [HELP_GUIDE_SOURCES.clIlce7m4],
  }

  return [wb, pp, cl]
}

/** Every entry with its group, flat — what search indexes. */
export function glossaryEntries(locale: Locale): readonly (GlossaryEntry & { group: ConceptGroup })[] {
  return buildGlossary(locale).flatMap((g) => g.entries.map((e) => ({ ...e, group: g.group })))
}
