import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CREATIVE_LOOK_CODES,
  RECIPE_FORMATS,
  WB_AUTO_MODES,
  WB_KELVIN,
  WB_PRESETS,
  WB_SHIFT_AXIS,
} from './constants';

/**
 * The SQL migration restates a handful of bounds that also live in
 * constants.ts. These assertions fail if the two drift apart — the SQL is
 * defence in depth, and defence that disagrees with the app is worse than none.
 */
const sql = readFileSync('supabase/migrations/0001_init.sql', 'utf8');

/** Pulls the value list out of `create type <name> as enum (...)`. */
function sqlEnum(name: string): string[] {
  const m = new RegExp(`create type ${name} as enum \\(([^)]*)\\)`, 'i').exec(sql);
  if (!m) throw new Error(`enum ${name} not found in migration`);
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

describe('SQL / constants drift', () => {
  it('recipe_format enum matches RECIPE_FORMATS', () => {
    expect(sqlEnum('recipe_format')).toEqual([...RECIPE_FORMATS]);
  });

  it('creative_look enum matches the ten built-in Looks', () => {
    expect(sqlEnum('creative_look')).toEqual([...CREATIVE_LOOK_CODES]);
  });

  it('wb_auto check matches WB_AUTO_MODES', () => {
    // Lazy up to the closing `))` — the values themselves contain parentheses,
    // e.g. 'AWB (Priority White)'.
    const m = /wb_auto\s+text\s+check \(wb_auto in \((.*?)\)\)/.exec(sql);
    expect(m, 'wb_auto check constraint not found').not.toBeNull();
    const values = [...m![1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
    expect(values).toEqual([...WB_AUTO_MODES]);
  });

  it('wb_kelvin bounds match WB_KELVIN', () => {
    const m = /wb_kelvin between (\d+) and (\d+)/.exec(sql);
    expect(m, 'wb_kelvin bounds not found').not.toBeNull();
    expect([Number(m![1]), Number(m![2])]).toEqual([WB_KELVIN.min, WB_KELVIN.max]);
  });

  it('wb shift bounds match WB_SHIFT_AXIS on both axes', () => {
    const bounds = [...sql.matchAll(/wb_shift_(?:ab|gm)_amount between (\d+) and (\d+)/g)];
    expect(bounds).toHaveLength(2);
    for (const b of bounds) {
      expect([Number(b[1]), Number(b[2])]).toEqual([WB_SHIFT_AXIS.min, WB_SHIFT_AXIS.max]);
    }
  });

  it('wb shift step constraint matches WB_SHIFT_AXIS.step', () => {
    // The SQL multiplies by 1/step to test grid alignment.
    const factor = 1 / WB_SHIFT_AXIS.step;
    const checks = [...sql.matchAll(/wb_shift_(?:ab|gm)_amount \* (\d+)\) = floor/g)];
    expect(checks).toHaveLength(2);
    for (const c of checks) expect(Number(c[1])).toBe(factor);
  });

  it('id check constraint matches the app-side id pattern', () => {
    const m = /id ~ '\^SCL-\(PP\|CL\)-\[0-9\]\{3\}\$'/.exec(sql);
    expect(m, 'recipes.id regex constraint not found or changed').not.toBeNull();
  });

  // The preset list arrived after 0001, so it lives in its own migration.
  it('wb_preset check matches WB_PRESETS', () => {
    const presetSql = readFileSync(
      'supabase/migrations/0006_wb_light_source_presets.sql',
      'utf8',
    );
    const m = /wb_preset in \(([\s\S]*?)\)\)/.exec(presetSql);
    expect(m, 'wb_preset check constraint not found').not.toBeNull();
    const values = [...m![1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
    expect(values).toEqual([...WB_PRESETS]);
  });

  it('wb_mode enum covers every mode the schema can produce', () => {
    // 0001 declares two, 0005 adds the third. Miss one and rows the app
    // considers valid are rejected by the database at insert time.
    const declared = [
      ...sqlEnum('wb_mode'),
      ...[...readFileSync('supabase/migrations/0005_wb_preset_enum_value.sql', 'utf8')
        .matchAll(/add value if not exists '([^']*)'/g)].map((x) => x[1]),
    ];
    expect(declared.sort()).toEqual(['auto', 'kelvin', 'preset']);
  });
});
