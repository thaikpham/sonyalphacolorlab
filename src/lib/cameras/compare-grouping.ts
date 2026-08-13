import type { SonyCamera } from './types';

export type CompareTabId =
  | 'all'
  | 'highlights'
  | 'sensorOptics'
  | 'videoIso'
  | 'afStab'
  | 'physical';

export interface SpecSectionGroup {
  id: 'sensorOptics' | 'videoIso' | 'afStab' | 'physical';
  labelKey: string;
  icon: string;
  specKeys: string[];
}

export const SPEC_SECTION_GROUPS: SpecSectionGroup[] = [
  {
    id: 'sensorOptics',
    labelKey: 'sectionSensorOptics',
    icon: '📷',
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
    icon: '🎥',
    specKeys: ['video', 'isoRange'],
  },
  {
    id: 'afStab',
    labelKey: 'sectionAfStab',
    icon: '🎯',
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
    icon: '📐',
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

export const SPEC_ICONS: Record<string, string> = {
  sensor: '📷',
  effectivePixels: '✨',
  isoRange: '🔆',
  autofocus: '🎯',
  video: '🎥',
  stabilization: '🖐️',
  viewfinder: '👁️',
  lcd: '🖥️',
  mediaSlots: '💾',
  battery: '🔋',
  weight: '⚖️',
  dimensions: '📐',
  format: '🖼️',
  focalLength: '🔭',
  maxAperture: '⭕',
  minAperture: '⭕',
  construction: '🔬',
  angleOfView: '📐',
  minFocusDistance: '🎯',
  maxMagnification: '🔍',
  filterDiameter: '⭕',
  apertureBlades: '⚙️',
  compatibility: '🔌',
  category: '📦',
  subCategory1: '🏷️',
  subCategory2: '📂',
  priceFormatted: '💳',
  sku: '🏷️',
};

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
 * Checks if a spec key has different values among the compared cameras.
 */
export function isSpecDifferent(cameras: SonyCamera[], key: string): boolean {
  if (cameras.length <= 1) return false;

  const values = cameras.map((c) => getSpecValue(c, key) ?? '—');
  const first = values[0];
  return values.some((v) => v !== first);
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
