import { SPEC_ROWS, type SonyCamera } from './types';

export type CompareTabId =
  | 'all'
  | 'highlights'
  | 'sensorOptics'
  | 'videoIso'
  | 'afStab'
  | 'physical'
  | 'audio';

export interface SpecSectionGroup {
  id: 'sensorOptics' | 'videoIso' | 'afStab' | 'physical' | 'audio';
  labelKey: string;
  specKeys: string[];
}

/** The camera, lens and accessory groups, which predate the audio catalogue. */
const IMAGING_GROUPS: SpecSectionGroup[] = [
  {
    id: 'sensorOptics',
    labelKey: 'sectionSensorOptics',
    specKeys: [
      'sensor',
      'effectivePixels',
      'format',
      'focalLength',
      'maxAperture',
      'minAperture',
      'construction',
      'angleOfView',
    ],
  },
  {
    id: 'videoIso',
    labelKey: 'sectionVideoIso',
    specKeys: ['video', 'isoRange'],
  },
  {
    id: 'afStab',
    labelKey: 'sectionAfStab',
    specKeys: [
      'autofocus',
      'stabilization',
      'viewfinder',
      'minFocusDistance',
      'maxMagnification',
    ],
  },
  {
    id: 'physical',
    labelKey: 'sectionPhysical',
    specKeys: [
      'lcd',
      'mediaSlots',
      'battery',
      'filterDiameter',
      'apertureBlades',
      'compatibility',
      'weight',
      'dimensions',
    ],
  },
];

/**
 * Every headphone and speaker row the imaging groups do not already draw.
 *
 * Derived from `SPEC_ROWS` rather than listed, because a list is what lost
 * them: the compare page loads audio on purpose, and a WH-1000XM6 against an
 * XM5 compared Battery and Weight and nothing else, while sixteen rows sat in
 * the schema. A field added to either kind now joins the grid by itself.
 * `battery`, `weight` and `dimensions` stay in `physical`, so a body and a
 * headset still meet on one row for each.
 */
const imagingKeys = new Set(IMAGING_GROUPS.flatMap((g) => g.specKeys));
const AUDIO_SPEC_KEYS = [...new Set([...SPEC_ROWS.headphone, ...SPEC_ROWS.speaker])].filter(
  (key) => !imagingKeys.has(key),
);

export const SPEC_SECTION_GROUPS: SpecSectionGroup[] = [
  ...IMAGING_GROUPS,
  { id: 'audio', labelKey: 'sectionAudio', specKeys: AUDIO_SPEC_KEYS },
];

/** The most products one compare holds — the hard limit both pickers state. */
export const MAX_COMPARE = 6;

/**
 * The compare page's products, from whatever `?ids=` a link carried.
 *
 * A repeated key arrives as an array (`?ids=a&ids=b`), and `.split` on it threw
 * to the error boundary. Ids the catalogue no longer has are dropped *before*
 * counting, so a stale link cannot hold slots that render no column — that is
 * what left an Add button whose every pick was refused. Then repeats go, and
 * the list stops at `MAX_COMPARE`, which a hand-written link could exceed.
 */
export function compareSelection(
  ids: string | readonly string[] | undefined,
  known: readonly string[],
): string[] {
  const raw = typeof ids === 'string' ? ids : (ids ?? []).join(',');
  const catalogue = new Set(known);
  const picked = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id && catalogue.has(id));
  return [...new Set(picked)].slice(0, MAX_COMPARE);
}

/**
 * Retrieves a spec value string for a camera and key.
 */
export function getSpecValue(camera: SonyCamera, key: string): string | null {
  if (!camera.specs) return null;
  const specs = camera.specs as unknown as Record<string, unknown>;
  const val = specs[key];
  if (typeof val === 'string') return val;
  return null;
}

/**
 * Whether one row's cells disagree, read from what each cell renders.
 *
 * Callers pass the rendered values, not spec keys. Keyed on `specs[key]`, the
 * check saw `null` for the price, the SKU and the category rows of every
 * product, so "Differences only" hid the price row of every compare and its
 * badge never appeared. A missing value renders as an em dash, so a
 * `null`, an empty string and a dash are one value here.
 */
export function valuesDiffer(values: readonly (string | null | undefined)[]): boolean {
  const shown = values.map((v) => v || '—');
  return shown.some((v) => v !== shown[0]);
}

/**
 * Filter sections and spec keys based on active tab and products present.
 */
export function getActiveSpecSections(
  cameras: SonyCamera[],
  activeTab: CompareTabId,
): SpecSectionGroup[] {
  if (activeTab === 'highlights') return [];

  return SPEC_SECTION_GROUPS.filter((group) => {
    if (activeTab !== 'all' && group.id !== activeTab) return false;

    // Keep group if at least one compared camera has a non-null value for any spec in this group
    return group.specKeys.some((key) =>
      cameras.some((c) => getSpecValue(c, key) !== null),
    );
  });
}
