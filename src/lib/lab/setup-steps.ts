/**
 * The eight settings a new Sony Alpha owner should change before the first
 * shoot, and the two menu trees they live in.
 *
 * Sony split the menu in two: a6400 and ZV-E10 keep the old `Camera Settings1/2`
 * tabs, a6700 and ZV-E10 II moved to the `Exposure/Color` · `Focus` · `Setup`
 * grouping. Same setting, same value, different path — so the paths are
 * computed from one `MenuVersion` rather than duplicated into two step lists.
 * Two lists is how the recap table and the step body drift apart: someone
 * corrects a path in one and not the other, and the tool starts contradicting
 * itself on the same screen.
 *
 * `stepId` is version-independent on purpose. Completion is a fact about the
 * camera ("ISO Auto is capped"), not about which menu tree you read to get
 * there — persisting `old-03` and `new-03` separately would silently reset a
 * reader's progress the moment they flipped the toggle to check a path.
 *
 * The prose is not here. The tool is UI, not an authored article, so its
 * kickers, titles and explanations live in `messages/*.json` under
 * `lab.setupSteps` (rule 3) and `/en/blog/setup` reads in English. What stays
 * in this file is what the camera prints — menu items, values, `Creative Look`
 * codes — which is never translated and so never enters a catalogue.
 */

import type { MenuVersion } from './types'

/** The recommended ceiling. Above it an APS-C file loses skin detail. */
const ISO_MAX = '6400'

/** The shutter floor. Below it a standing subject's own movement blurs. */
const MIN_SS = '1/125'

export type Setting = {
  readonly label: string
  readonly value: string
  /** Full menu path for the selected version, arrows included. */
  readonly path: string
}

export type SetupStep = {
  /** Stable across menu versions — the persistence key. */
  readonly id: string
  /** "01"–"08". Rendered in the gutter and the jump bar. */
  readonly n: string
  /** `#` target for the jump bar. */
  readonly anchor: string
  readonly kicker: string
  readonly title: string
  readonly settings: readonly Setting[]
  readonly why: string
  /** An optional aside — one step carries the back-button-AF technique. */
  readonly tip?: {
    readonly title: string
    readonly body: string
    readonly settings: readonly { readonly label: string; readonly path: string }[]
  }
}

/**
 * The `lab` translator, narrowed to the one call shape this module makes —
 * `useTranslations('lab')` satisfies it. Numbers and camera names go in as ICU
 * arguments, so a catalogue edit cannot drift them away from the paths.
 */
export type SetupCopy = (key: string, values?: Record<string, string>) => string

/** The paths, both trees, in one table so a correction lands once. */
function paths(v: MenuVersion, t: SetupCopy) {
  const isNew = v === 'new'
  /* The only words in a path that are not printed on the camera: the physical
     controls, named in the reader's language. */
  const modeDial = t('setupPaths.modeDial')
  const aelButton = t('setupPaths.aelButton')
  return {
    mode: isNew
      ? `${modeDial} → A (a6700) · MENU → Shooting → Shooting Mode → Shoot Mode → A (ZV-E10 II)`
      : `${modeDial} → A (a6400) · ${t('setupPaths.modeButton')} → A (ZV-E10)`,
    iso: isNew
      ? 'MENU → Exposure/Color → Exposure → ISO → ISO AUTO'
      : 'MENU → Camera Settings1 → ISO → ISO AUTO',
    minss: isNew
      ? 'MENU → Exposure/Color → Exposure → ISO AUTO Min. SS'
      : 'MENU → Camera Settings1 → ISO AUTO Min. SS',
    focusMode: isNew
      ? 'MENU → Focus → AF/MF → Focus Mode'
      : 'MENU → Camera Settings1 → Focus Mode',
    focusArea: isNew
      ? 'MENU → Focus → Focus Area → Focus Area'
      : 'MENU → Camera Settings1 → Focus Area',
    customKey: isNew
      ? `MENU → Setup → Operation Customize → Custom Key/Dial Set. → ${aelButton} → AF ON`
      : `MENU → Camera Settings2 → Custom Key (Shoot) → ${aelButton} → AF ON`,
    afShutter: isNew
      ? 'MENU → Focus → AF/MF → AF w/ Shutter → Off'
      : 'MENU → Camera Settings1 → AF w/ shutter → Off',
    metering: isNew
      ? 'MENU → Exposure/Color → Metering → Metering Mode'
      : 'MENU → Camera Settings1 → Metering Mode',
    facePriority: isNew
      ? 'MENU → Exposure/Color → Metering → Face Priority in Multi Mtr.'
      : 'MENU → Camera Settings1 → Face Priority in Multi Metering',
    look: isNew
      ? 'MENU → Exposure/Color → Color/Tone → Creative Look'
      : 'MENU → Camera Settings1 → Creative Style',
    brightness: isNew
      ? 'MENU → Setup → Display Option → Monitor Brightness'
      : 'MENU → Setup → Monitor Brightness',
    quality: isNew
      ? 'MENU → Setup → Display Option → Display Quality'
      : 'MENU → Setup → Display Quality',
  }
}

export function setupSteps(v: MenuVersion, t: SetupCopy): readonly SetupStep[] {
  const isNew = v === 'new'
  const p = paths(v, t)
  const c = (key: string, values?: Record<string, string>) => t(`setupSteps.${key}`, values)
  /* Sony renamed the feature between the two menu generations; the tool shows
     whichever name is printed on the reader's camera. */
  const look = isNew ? 'Creative Look' : 'Creative Style'
  const lookNeutral = isNew ? 'ST' : 'Standard'
  const lookPortrait = isNew ? 'PT' : 'Portrait'
  const lookVal = c('or', { a: lookNeutral, b: lookPortrait })

  const raw: readonly Omit<SetupStep, 'n' | 'anchor'>[] = [
    {
      id: 'shoot-mode',
      kicker: c('shootMode.kicker'),
      title: c('shootMode.title'),
      settings: [{ label: 'Shoot Mode', value: c('shootMode.value'), path: p.mode }],
      why: c('shootMode.why'),
    },
    {
      id: 'iso-auto-range',
      kicker: c('isoAutoRange.kicker'),
      title: c('isoAutoRange.title', { isoMax: ISO_MAX }),
      settings: [
        {
          label: 'ISO AUTO Min / Max',
          value: `100–${ISO_MAX}`,
          path: `${p.iso} → Minimum 100 · Maximum ${ISO_MAX}`,
        },
      ],
      why: c('isoAutoRange.why', { isoMax: ISO_MAX }),
    },
    {
      id: 'min-shutter',
      kicker: c('minShutter.kicker'),
      title: c('minShutter.title', { minSs: MIN_SS }),
      settings: [
        { label: 'ISO AUTO Min. SS', value: MIN_SS, path: `${p.minss} → ${MIN_SS}` },
      ],
      why: c('minShutter.why', { minSs: MIN_SS }),
    },
    {
      id: 'focus-mode',
      kicker: c('focusMode.kicker'),
      title: c('focusMode.title'),
      settings: [
        { label: 'Focus Mode', value: 'AF-C', path: `${p.focusMode} → Continuous AF` },
      ],
      why: c('focusMode.why'),
    },
    {
      id: 'focus-area',
      kicker: c('focusArea.kicker'),
      title: c('focusArea.title'),
      settings: [
        { label: 'Focus Area', value: 'Tracking: Zone', path: `${p.focusArea} → Tracking: Zone` },
      ],
      why: c('focusArea.why'),
      tip: {
        title: c('focusArea.tipTitle'),
        body: c('focusArea.tipBody'),
        settings: [
          { label: c('focusArea.tipAssign'), path: p.customKey },
          { label: c('focusArea.tipHalfPress'), path: p.afShutter },
        ],
      },
    },
    {
      id: 'metering',
      kicker: c('metering.kicker'),
      title: c('metering.title'),
      settings: [
        { label: 'Metering Mode', value: 'Multi', path: `${p.metering} → Multi` },
        { label: 'Face Priority in Multi', value: 'On', path: `${p.facePriority} → On` },
      ],
      why: c('metering.why'),
    },
    {
      id: 'creative-look',
      kicker: c('creativeLook.kicker'),
      title: c('creativeLook.title', { look, value: lookVal }),
      settings: [
        {
          label: look,
          value: lookVal,
          path: `${p.look} → ${lookNeutral} · ${lookPortrait}`,
        },
      ],
      why: c('creativeLook.why', { neutral: lookNeutral, portrait: lookPortrait }),
    },
    {
      id: 'monitor',
      kicker: c('monitor.kicker'),
      /* Nothing but the camera's own labels, so it reads the same in both
         languages and stays out of the catalogue. */
      title: 'Monitor Brightness: Sunny Weather · Display Quality: High',
      settings: [
        { label: 'Monitor Brightness', value: 'Sunny Weather', path: `${p.brightness} → Sunny Weather` },
        { label: 'Display Quality', value: 'High', path: `${p.quality} → High` },
      ],
      why: c('monitor.why'),
    },
  ]

  return raw.map((s, i) => ({
    ...s,
    n: String(i + 1).padStart(2, '0'),
    anchor: `step-${i + 1}`,
  }))
}

export type RecapRow = {
  readonly n: string
  readonly label: string
  readonly value: string
  readonly path: string
}

/**
 * Every setting the tool asks for, flattened — including the ones inside the
 * AF-ON aside, which are real menu changes and would otherwise be the two the
 * reader forgets they made.
 */
export function recapRows(steps: readonly SetupStep[]): readonly RecapRow[] {
  const rows: RecapRow[] = []
  for (const step of steps) {
    for (const s of step.settings) {
      rows.push({ n: step.n, label: s.label, value: s.value, path: s.path })
    }
    for (const t of step.tip?.settings ?? []) {
      rows.push({ n: step.n, label: t.label, value: 'AF-ON', path: t.path })
    }
  }
  return rows
}

/**
 * Every step id, for the progress denominator and for pruning stale storage.
 * Ids do not depend on the copy, so the key itself stands in for a translator.
 */
export const STEP_IDS: readonly string[] = setupSteps('old', (key) => key).map((s) => s.id)
