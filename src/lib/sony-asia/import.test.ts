import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importSonyAsia, parseCsv, recipeKey, REJECTED, SCRAPE_CORRECTIONS } from './import';
import { SONY_ASIA_IDS } from './ids';
import {
  CL_MONOCHROME_LOOKS,
  CL_RANGES,
  CREATIVE_LOOK_CODES,
  CREATIVE_LOOKS,
  WB_AUTO_MODES,
  WB_PRESETS,
} from '../camera/constants';
import { recipeSchema } from '../camera/schema';
import { ORIGINAL_CL } from '../originals/cl';

/**
 * The scrape is a third-party HTML export of a marketing page: inconsistent
 * spelling, repeated rows, and settings the camera cannot take. These tests pin
 * the two behaviours that matter — every recipe that survives is a legal camera
 * state, and every row that does not survive is *reported* rather than quietly
 * dropped or filled in with a plausible guess.
 */
const csv = readFileSync('data/sony-asia-creative-looks.csv', 'utf8');
const result = importSonyAsia(csv);

describe('Sony Asia CSV', () => {
  it('reads every scraped row', () => {
    expect(parseCsv(csv)).toHaveLength(53);
  });

  it('produces recipes, and accounts for every row it did not', () => {
    // rows = recipes + merged duplicates + skips. Nothing vanishes silently.
    expect(result.recipes.length + result.duplicates + result.skipped.length).toBe(53);
    expect(result.recipes.length).toBeGreaterThan(30);
  });

  it('gives every skipped row a reason', () => {
    for (const s of result.skipped) {
      expect(s.why.length, s.data).toBeGreaterThan(20);
    }
  });
});

describe('imported recipes', () => {
  it('every recipe re-validates against recipeSchema', () => {
    for (const r of result.recipes) {
      const { images: _i, credit: _c, ...recipe } = r;
      const parsed = recipeSchema.safeParse(recipe);
      expect(parsed.success, `${r.id}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it('is entirely Creative Look, with ids and slugs to match', () => {
    const slugs = new Set<string>();
    const ids = new Set<string>();
    for (const r of result.recipes) {
      expect(r.format).toBe('cl');
      expect(r.id).toMatch(/^SCL-CL-\d{3}$/);
      expect(slugs.has(r.slug), `duplicate slug ${r.slug}`).toBe(false);
      expect(ids.has(r.id), `duplicate id ${r.id}`).toBe(false);
      slugs.add(r.slug);
      ids.add(r.id);
    }
  });

  it('only uses the ten built-in Looks', () => {
    for (const r of result.recipes) {
      expect(CREATIVE_LOOK_CODES).toContain((r.settings as { look: string }).look);
    }
  });

  it('holds every parameter inside its own range', () => {
    for (const r of result.recipes) {
      const s = r.settings as unknown as Record<string, number>;
      for (const [param, range] of Object.entries(CL_RANGES)) {
        if (s[param] === undefined) continue;
        expect(s[param], `${r.id}.${param}`).toBeGreaterThanOrEqual(range.min);
        expect(s[param], `${r.id}.${param}`).toBeLessThanOrEqual(range.max);
      }
    }
  });

  it('omits Saturation on monochrome Looks and sets it everywhere else', () => {
    for (const r of result.recipes) {
      const s = r.settings as { look: string; saturation?: number };
      const mono = (CL_MONOCHROME_LOOKS as readonly string[]).includes(s.look);
      expect(s.saturation === undefined, `${r.id} (${s.look})`).toBe(mono);
    }
  });

  it('carries a photographer credit and a source URL on every recipe', () => {
    for (const r of result.recipes) {
      expect(r.credit.photographer.length, r.id).toBeGreaterThan(0);
      expect(r.credit.source).toContain('sony-asia.com');
    }
  });

  it('writes an English description for every recipe', () => {
    for (const r of result.recipes) {
      expect(result.descriptions[r.id]?.length ?? 0, r.id).toBeGreaterThan(30);
    }
  });
});

describe('White Balance from the scrape', () => {
  const wbOf = (slug: string) => result.recipes.find((r) => r.slug === slug)?.whiteBalance;

  it('reads a light-source preset with a shift', () => {
    // "WB Cloudy A1.5, M0.5" — the pairing the preset mode was added for.
    expect(wbOf('fl-arantha-sirimanne')).toEqual({
      mode: 'preset',
      preset: 'Cloudy',
      shift: { ab: { axis: 'A', amount: 1.5 }, gm: { axis: 'M', amount: 0.5 } },
    });
  });

  it('reads a bare preset', () => {
    expect(wbOf('vv-khong')).toEqual({ mode: 'preset', preset: 'Daylight' });
  });

  it('reads Kelvin with a space-separated shift', () => {
    // "WB Colour Temp 6500K B2.5 M5.0" — the page separates with spaces, the
    // legacy parser expects commas.
    expect(wbOf('in-sony-asia')).toEqual({
      mode: 'kelvin',
      kelvin: 6500,
      shift: { ab: { axis: 'B', amount: 2.5 }, gm: { axis: 'M', amount: 5 } },
    });
  });

  it('reads AWB with a shift', () => {
    expect(wbOf('in-jonpoon-jpg')).toEqual({
      mode: 'auto',
      auto: 'AWB',
      shift: { ab: { axis: 'A', amount: 1 }, gm: { axis: 'G', amount: 1 } },
    });
  });

  it('survives a newline inside the WB clause', () => {
    // One row is scraped as "WB Colour\n\nTemp 5000K A3 G1". Splitting the
    // settings on the blank line truncated it and lost the setting entirely.
    expect(wbOf('fl-hea-kimhong')).toEqual({
      mode: 'kelvin',
      kelvin: 5000,
      shift: { ab: { axis: 'A', amount: 3 }, gm: { axis: 'G', amount: 1 } },
    });
  });
});

/* Synthetic rows, so a parsing rule can be pinned without waiting for the
   scrape to contain an instance of it. */
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const csvOf = (...data: string[]) =>
  ['name,data,data2,data3,data4,image,image11', ...data.map((d) => ['Test', d, '', 'Testland', '', '', ''].map(q).join(','))].join('\n');
const ST = 'ST (Standard) | Contrast 0, Highlights 0, Shadows 0, Fade 0, Saturation 0, Sharpness 4, Sharpness Range 3, Clarity 1';

describe('parseCsv', () => {
  it('strips a BOM, unescapes doubled quotes and keeps newlines inside quotes', () => {
    expect(parseCsv('﻿a,b\r\n"x ""q""\ny",2\r\n')).toEqual([{ a: 'x "q"\ny', b: '2' }]);
  });

  it('drops CR outside quotes but keeps it inside them', () => {
    expect(parseCsv('a,b\r\n"l1\r\nl2",2\r\n')).toEqual([{ a: 'l1\r\nl2', b: '2' }]);
  });

  it('adds no row for a trailing newline, and none for a blank or one-column line', () => {
    expect(parseCsv('a,b\n1,2\n\nstray\n')).toEqual([{ a: '1', b: '2' }]);
  });

  it('refuses an unterminated quote instead of swallowing the rest of the file', () => {
    expect(() => parseCsv('a,b\n"open,1\n2,3\n')).toThrow(/unterminated/i);
  });
});

describe('settings tokens', () => {
  it('reports a parameter written with no number, rather than storing 0', () => {
    // "Contrast 0 and no Contrast token are different claims" — and so is a
    // Contrast token with no number. Number('') is 0.
    const { recipes, skipped } = importSonyAsia(csvOf(`${ST.replace('Contrast 0', 'Contrast')}, WB AWB`));
    expect(recipes).toHaveLength(0);
    expect(skipped[0]?.why).toContain('contrast');
    const fade = importSonyAsia(csvOf(`${ST.replace('Fade 0', 'Fade ')}, WB AWB`));
    expect(fade.skipped[0]?.why).toContain('fade');
  });

  it('splits tokens on a comma with no space after it', () => {
    // Why SCRAPE_CORRECTIONS needs no "Fade 0,Saturation" entry.
    const { recipes } = importSonyAsia(csvOf(`${ST.replace('Fade 0, Saturation 0', 'Fade 2,Saturation 3')}, WB AWB`));
    expect(recipes[0]?.settings).toMatchObject({ fade: 2, saturation: 3 });
    expect(SCRAPE_CORRECTIONS.some((c) => c.from.includes('Fade 0,Saturation'))).toBe(false);
  });
});

describe('White Balance names from constants.ts', () => {
  it('reads every light-source preset and Auto mode by its own name', () => {
    for (const preset of WB_PRESETS) {
      const { recipes } = importSonyAsia(csvOf(`${ST}, WB ${preset}`));
      expect(recipes[0]?.whiteBalance, preset).toEqual({ mode: 'preset', preset });
    }
    for (const auto of WB_AUTO_MODES) {
      const { recipes } = importSonyAsia(csvOf(`${ST}, WB ${auto}`));
      expect(recipes[0]?.whiteBalance, auto).toEqual({ mode: 'auto', auto });
    }
  });
});

/**
 * Ids and slugs are public URLs, and `translations.vi.json` and the credits
 * file are keyed by id. Numbering by row order meant un-skipping one row
 * shifted every later id, and the Vietnamese prose then named the wrong
 * photographer on every recipe after it.
 */
describe('stable ids', () => {
  const keyOf = (r: (typeof result.recipes)[number]) =>
    recipeKey(r.settings as Record<string, unknown>, r.whiteBalance, r.credit.photographer);

  it('gives every imported recipe the id and slug it was first published under', () => {
    expect(result.unpinned, 'add these to SONY_ASIA_IDS in ids.ts').toEqual([]);
    for (const r of result.recipes) {
      expect(SONY_ASIA_IDS[keyOf(r)], r.id).toEqual({ id: r.id, slug: r.slug });
    }
  });

  it('still produces every pinned recipe, so none is renumbered by accident', () => {
    // A pinned key that stops matching means a correction changed a recipe's
    // settings: re-key the entry, never let the recipe take a new id.
    const produced = new Set(result.recipes.map((r) => r.id));
    for (const [key, pin] of Object.entries(SONY_ASIA_IDS)) {
      expect(produced.has(pin.id), `${pin.id} (${key})`).toBe(true);
    }
  });

  it('matches the ids and slugs the committed seed ships', () => {
    const seed = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as { id: string; slug: string; format: string }[];
    /* ColorLab's own Creative Looks share the seed and the id sequence but not
       the importer: they are numbered after its pins. */
    const ours = new Set(ORIGINAL_CL.map((o) => o.recipe.id));
    const shipped = seed.filter((r) => r.format === 'cl' && !ours.has(r.id)).map((r) => [r.id, r.slug]);
    expect(result.recipes.map((r) => [r.id, r.slug])).toEqual(shipped);
  });

  it('keeps every id when a skipped row becomes importable', () => {
    // Row 1 is Sandeeshwara Perera's FL "Default Settings", on the skip list.
    const filled = csv.replace(
      'FL (Film Look) | Default Settings',
      'FL (Film Look) | Contrast +1, Highlights 0, Shadows 0, Fade +1, Saturation 0, Sharpness +3, Sharpness Range +3, Clarity +1, WB AWB',
    );
    expect(filled).not.toBe(csv);
    const after = importSonyAsia(filled);
    expect(after.recipes.length).toBe(result.recipes.length + 1);

    for (const before of result.recipes) {
      const same = after.recipes.find((r) => r.id === before.id);
      expect(same?.slug, before.id).toBe(before.slug);
      expect(same?.name, before.id).toBe(before.name);
      expect(same?.credit.photographer, before.id).toBe(before.credit.photographer);
      expect(same?.settings, before.id).toEqual(before.settings);
      expect(after.descriptions[before.id], before.id).toBe(result.descriptions[before.id]);
    }

    // The newcomer takes the next free id and a slug no pinned recipe holds.
    expect(after.unpinned).toHaveLength(1);
    const added = after.recipes.find((r) => !result.recipes.some((b) => b.id === r.id))!;
    expect(added.id).toBe('SCL-CL-038');
    expect(added.slug).toBe('fl-sandeeshwara-perera-4');
    expect(added.name).toBe('SCL-CL-038: Film · Sandeeshwara Perera 4');
  });

  it('never hands out a retired id or slug again', () => {
    const retired = { ...SONY_ASIA_IDS, 'retired recipe': { id: 'SCL-CL-090', slug: 'st-test' } };
    const { recipes } = importSonyAsia(csvOf(`${ST}, WB AWB`), retired);
    expect(recipes[0]?.id).toBe('SCL-CL-091');
    expect(recipes[0]?.slug).toBe('st-test-2');
  });

  it('steps past the ids and slugs ColorLab’s own Creative Looks hold', () => {
    /* The originals share the SCL-CL- sequence. emit-seed passes them as
       `reserved`, so a newcomer the scrape has never seen cannot be handed
       CL-038 — the number Mono Deep Noir already holds. */
    const reserved = {
      ids: ORIGINAL_CL.map((o) => o.recipe.id),
      slugs: ORIGINAL_CL.map((o) => o.recipe.slug),
    };
    const last = Math.max(...reserved.ids.map((id) => Number(id.slice(-3))));
    const { recipes } = importSonyAsia(csvOf(`${ST}, WB AWB`), SONY_ASIA_IDS, reserved);
    expect(recipes[0]?.id).toBe(`SCL-CL-${String(last + 1).padStart(3, '0')}`);
    expect(reserved.slugs).not.toContain(recipes[0]?.slug);

    /* And a reserved slug the newcomer would otherwise take is stepped past:
       this row's own slug is `st-test`. */
    const own = importSonyAsia(csvOf(`${ST}, WB AWB`), SONY_ASIA_IDS);
    expect(own.recipes[0]?.slug).toBe('st-test');
    const stepped = importSonyAsia(csvOf(`${ST}, WB AWB`), SONY_ASIA_IDS, { slugs: ['st-test'] });
    expect(stepped.recipes[0]?.slug).toBe('st-test-2');
    const emit = readFileSync('scripts/emit-seed.ts', 'utf8');
    expect(emit).toMatch(/importSonyAsia\(readFileSync\([^)]*\), SONY_ASIA_IDS, \{\s*ids: ORIGINAL_CL\.map/);
    expect(emit).toContain('slugs: ORIGINAL_CL.map((o) => o.recipe.slug)');
  });
});

describe('corrections and refusals', () => {
  it('fixes the SH Look code without corrupting the correct ones', () => {
    // An unanchored 'H (Soft Highkey)' -> 'SH (…)' rewrite also matches inside
    // a correct 'SH (Soft Highkey)' and produces 'SSH'.
    const looks = result.recipes.map((r) => (r.settings as { look: string }).look);
    expect(looks).toContain('SH');
    expect(looks.filter((l) => l === 'SH').length).toBeGreaterThan(1);
  });

  it('reads VV2, whose code contains a digit', () => {
    expect(result.recipes.some((r) => (r.settings as { look: string }).look === 'VV2')).toBe(true);
  });

  it('refuses a Kelvin range rather than picking an end of it', () => {
    expect(result.skipped.some((s) => s.data.includes('5200K-5600K'))).toBe(true);
    for (const r of result.recipes) {
      expect(JSON.stringify(r.whiteBalance)).not.toContain('-');
    }
  });

  it('refuses "Default Settings" rather than inventing per-Look defaults', () => {
    // Sony's Creative Look page documents what each Look is but publishes no
    // default value for any parameter, and Sharpness Range starts at 1, so
    // "all zeros" is not even a legal row.
    expect(CL_RANGES.sharpnessRange.min).toBe(1);
    expect(result.skipped.filter((s) => /Default Settings/i.test(s.data)).length).toBeGreaterThan(0);
  });

  it('refuses a row with no stated White Balance', () => {
    const noWb = result.skipped.filter((s) => s.why.includes('no White Balance'));
    expect(noWb.length).toBeGreaterThan(0);
  });

  it('documents why every correction and refusal exists', () => {
    for (const c of SCRAPE_CORRECTIONS) expect(c.why.length).toBeGreaterThan(20);
    for (const r of REJECTED) expect(r.why.length).toBeGreaterThan(20);
  });
});

describe('Look names come from constants.ts', () => {
  /* Sony spells them "Vivid 2" and "Film" (TP1000640837). The scrape said
     "Vivid2" and "Film Look", and a correction even rewrote the right
     spelling to the wrong one, so 19 recipes disagreed with the glossary,
     the header filter and the admin select. */
  it('names and tags every recipe with the CREATIVE_LOOKS label', () => {
    for (const r of result.recipes) {
      if (r.format !== 'cl') continue;
      const label = CREATIVE_LOOKS.find((l) => l.code === r.settings.look)!.label;
      expect(r.name, r.id).toContain(`: ${label} · `);
      expect(r.tags, r.id).toContain(label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    }
    expect(result.recipes.some((r) => /Vivid2|Film Look/.test(r.name))).toBe(false);
  });
});
