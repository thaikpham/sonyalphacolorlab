/**
 * One-shot migration from the original sonycolorlab dataset to the
 * Alpha ColorLab schema.
 *
 * Every legacy recipe must come out the other side satisfying `recipeSchema`,
 * or the migration fails loudly. Nothing is silently coerced: where the legacy
 * data is genuinely wrong, the fix is recorded in LEGACY_CORRECTIONS with a
 * reason, so the change is auditable rather than invisible.
 */

import { parseWhiteBalance } from '../camera/format';
import { recipeSchema, type Recipe } from '../camera/schema';

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

/**
 * Values in the legacy dataset that the camera cannot accept.
 * Each entry needs a reason and a source for the replacement value.
 */
export const LEGACY_CORRECTIONS: Record<string, { path: string; from: unknown; to: unknown; why: string }[]> = {
  'scl-044': [
    {
      path: 'detailSettings.vhBalance',
      from: '-22',
      to: -2,
      why:
        'V/H Balance is -2..+2 (helpguide TP0000909112). "-22" is unenterable on any body; ' +
        'read as a typo for -2, the axis minimum. NEEDS CONFIRMATION from the recipe author.',
    },
  ],
};

/**
 * Legacy ids that do not fit the SCL-<FORMAT>-NNN scheme.
 * PROCOLOR-* is a distinct product line in the original dataset; these are
 * provisionally folded into the PP sequence. NEEDS CONFIRMATION.
 */
export const ID_REMAP: Record<string, string> = {
  'PROCOLOR-001': 'SCL-PP-045',
  'PROCOLOR-002': 'SCL-PP-046',
  'PROCOLOR-003': 'SCL-PP-047',
};

// ---------------------------------------------------------------------------
// Field coercion
// ---------------------------------------------------------------------------

/** Legacy stored numbers as strings ("+25", "-7", "0"). */
function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  const n = Number(String(v).trim());
  if (!Number.isFinite(n)) throw new Error(`not numeric: ${JSON.stringify(v)}`);
  return n;
}

/** "Wide +5" -> { range: 'Wide', level: 5 } */
function parseBlackGamma(s: string) {
  const m = /^\s*(Narrow|Middle|Wide)\s*([+-]?\d+)\s*$/.exec(s);
  if (!m) throw new Error(`unparseable Black Gamma: ${JSON.stringify(s)}`);
  return { range: m[1] as 'Narrow' | 'Middle' | 'Wide', level: Number(m[2]) };
}

/** "Auto" | "Manual 92.5% +3" */
function parseKnee(s: string) {
  if (/^\s*Auto\s*$/i.test(s)) return { mode: 'Auto' as const };
  const m = /^\s*Manual\s+(\d+(?:\.\d+)?)%\s*([+-]?\d+)\s*$/.exec(s);
  if (!m) throw new Error(`unparseable Knee: ${JSON.stringify(s)}`);
  return { mode: 'Manual' as const, point: Number(m[1]), slope: Number(m[2]) };
}

/** "Type 3" and "Type3" both appear in the wild; Sony writes "Type3". */
function normalizeBwBalance(s: unknown): string {
  return String(s).replace(/\s+/g, '');
}

/** "SCL-001: Mojave Sun" -> "mojave-sun" */
export function toSlug(name: string): string {
  return name
    .replace(/^[A-Z]+-[A-Z0-9-]*\d+\s*:\s*/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "scl-001" -> "SCL-PP-001" (all legacy recipes are Picture Profile). */
export function toRecipeId(legacyId: string): string {
  if (ID_REMAP[legacyId]) return ID_REMAP[legacyId];
  const m = /^scl-(\d+)$/i.exec(legacyId);
  if (!m) throw new Error(`unmappable legacy id: ${legacyId}`);
  return `SCL-PP-${m[1].padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/** The original dataset is untyped JS with inconsistent key casing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LegacyRecipe = Record<string, any>;

export type MigrationResult =
  | { ok: true; recipe: Recipe; legacyId: string; corrections: number }
  | { ok: false; legacyId: string; error: string };

function applyCorrections(legacy: LegacyRecipe): { data: LegacyRecipe; count: number } {
  const fixes = LEGACY_CORRECTIONS[legacy.id];
  if (!fixes?.length) return { data: legacy, count: 0 };
  const data = structuredClone(legacy);
  for (const fix of fixes) {
    const parts = fix.path.split('.');
    const leaf = parts.pop()!;
    let node: Record<string, unknown> | undefined = data;
    for (const p of parts) node = node?.[p] as Record<string, unknown> | undefined;
    if (node) node[leaf] = fix.to;
  }
  return { data, count: fixes.length };
}

export function migrateRecipe(input: LegacyRecipe): MigrationResult {
  const legacyId = String(input.id);
  try {
    const { data: legacy, count: corrections } = applyCorrections(input);
    const s = legacy.settings ?? {};
    const d = legacy.detailSettings ?? {};
    const cd = legacy.colorDepth ?? {};

    const wb = parseWhiteBalance(String(legacy.whiteBalance ?? ''));
    if (!wb) throw new Error(`unparseable whiteBalance: ${JSON.stringify(legacy.whiteBalance)}`);

    const id = toRecipeId(legacyId);
    const name = String(legacy.name ?? '').replace(
      /^[A-Z]+-[A-Z0-9-]*\d+\s*:\s*/i,
      `${id}: `,
    );

    const candidate = {
      id,
      slug: toSlug(String(legacy.name ?? '')),
      name,
      format: 'pp' as const,
      whiteBalance: wb,
      tags: Array.isArray(legacy.tags) ? legacy.tags.map((t: string) => t.toLowerCase()) : [],
      published: true,
      settings: {
        // legacy key is "Black level" (lowercase L)
        blackLevel: toNum(s['Black level'] ?? s['Black Level']),
        gamma: s.Gamma,
        blackGamma: parseBlackGamma(String(s['Black Gamma'])),
        knee: parseKnee(String(s.Knee)),
        colorMode: s['Color Mode'],
        saturation: toNum(s.Saturation),
        colorPhase: toNum(s['Color Phase']),
        colorDepth: {
          R: toNum(cd.R), G: toNum(cd.G), B: toNum(cd.B),
          C: toNum(cd.C), M: toNum(cd.M), Y: toNum(cd.Y),
        },
        detail: {
          level: toNum(d.level),
          mode: d.mode,
          vhBalance: toNum(d.vhBalance),
          bwBalance: normalizeBwBalance(d.bwBalance),
          limit: toNum(d.limit),
          crispening: toNum(d.crispening),
          hiLightDetail: toNum(d.hiLightDetail),
        },
      },
    };

    const parsed = recipeSchema.safeParse(candidate);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      throw new Error(detail);
    }
    return { ok: true, recipe: parsed.data, legacyId, corrections };
  } catch (e) {
    return { ok: false, legacyId, error: e instanceof Error ? e.message : String(e) };
  }
}

export function migrateAll(legacy: LegacyRecipe[]) {
  const results = legacy.map(migrateRecipe);
  return {
    results,
    ok: results.filter((r): r is Extract<MigrationResult, { ok: true }> => r.ok),
    failed: results.filter((r): r is Extract<MigrationResult, { ok: false }> => !r.ok),
  };
}
