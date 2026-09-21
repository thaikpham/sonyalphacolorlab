/**
 * Builds the Creative Look library from Sony's Alpha Recipes microsite.
 *
 * Source: a Web Scraper export of
 * https://www.sony-asia.com/microsite/rmdc/creativelooks/alpha-recipes/
 * committed as `data/sony-asia-creative-looks.csv`.
 *
 * This is the Creative Look counterpart to `src/lib/legacy/migrate.ts`, and
 * follows the same discipline: the scrape is treated as untrusted input, every
 * value is parsed rather than assumed, and anything the camera cannot accept is
 * corrected *by name* in `SCRAPE_CORRECTIONS` with a reason. A recipe that
 * cannot be parsed is reported, never guessed at.
 *
 * The scrape is one row per *photo*, not per recipe — the microsite shows a
 * carousel per photographer, so identical settings repeat up to four times.
 * Rows are deduplicated on their settings, and the images collapse into one
 * recipe.
 */

import { parseWhiteBalance } from '../camera/format';
import { recipeSchema, type Recipe, type WhiteBalance } from '../camera/schema';
import { CL_MONOCHROME_LOOKS, CREATIVE_LOOK_CODES } from '../camera/constants';

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export type ScrapeRow = Record<string, string>;

/** Minimal RFC4180 reader. The scrape has embedded newlines and quotes. */
export function parseCsv(text: string): ScrapeRow[] {
  const s = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c !== '"') {
        field += c;
      } else if (s[i + 1] === '"') {
        // An escaped quote inside a quoted field: consume both, keep one.
        field += '"';
        i++;
      } else {
        quoted = false;
      }
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') endField();
    else if (c === '\n') endRow();
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) endRow();

  const [header, ...body] = rows;
  return body
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

/** `from` is a regular expression source, applied with the `g` flag. */
export type Correction = { from: string; to: string; why: string };

/**
 * Fixes applied to the scraped `data` string before parsing. Every one is a
 * defect in the published page, not a guess about what the photographer meant —
 * where the page is genuinely ambiguous the row is rejected instead (see
 * `REJECTED` and the "not published" skips below).
 */
export const SCRAPE_CORRECTIONS: Correction[] = [
  {
    // Anchored: an unanchored 'H (Soft Highkey)' also matches inside the
    // correct 'SH (Soft Highkey)' and rewrites it to 'SSH'.
    from: '^H \\(Soft Highkey\\)',
    to: 'SH (Soft Highkey)',
    why: 'The Look code for Soft Highkey is SH; the page dropped the S on one entry.',
  },
  {
    from: 'VV2 \\(Vivid 2 Preset\\)',
    to: 'VV2 (Vivid2)',
    why: '"Preset" is page furniture, not part of the Look name.',
  },
  {
    from: 'VV2 \\(Vivid 2\\)',
    to: 'VV2 (Vivid2)',
    why: 'Sony spells the Look "Vivid2"; the space is a typo on some entries.',
  },
  {
    from: 'WB Colour Temp AWB',
    to: 'WB AWB',
    why: 'Contradictory: C.Temp./Filter and Auto are different menu items. AWB is the operative one.',
  },
  {
    from: 'Fade 0,Saturation',
    to: 'Fade 0, Saturation',
    why: 'Missing space after a comma would swallow the Saturation token.',
  },
];

/**
 * One photographer, two spellings on the page. The credit and the recipe
 * title use the form the page uses most often.
 */
export const PHOTOGRAPHER_SPELLING: Record<string, string> = {
  'jonpoon.jpg': 'Jonpoon.jpg',
};

/**
 * The page prints its shoot notes as separate lines ("Shot with Creative
 * Looks" / "Crop & RGB adjusted in post."). Collapsing the whitespace alone
 * runs them into one unpunctuated sentence, so the lines are joined as
 * clauses and the sentence is closed.
 */
export function formatNotes(raw: string): string {
  const parts = raw
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim().replace(/\.+$/, ''))
    .filter(Boolean)
    .map((p, i) => (i > 0 && /^[A-Z][a-z]/.test(p) ? p[0].toLowerCase() + p.slice(1) : p))
    .map((p) => p.replace(/ & /g, ' and '));
  return parts.length ? `${parts.join('; ')}.` : '';
}

/**
 * Rows the scrape cannot express as a single camera state. Keyed by the
 * settings string, so a page fix makes the entry stop matching rather than
 * silently masking a different row.
 */
export const REJECTED: { match: string; why: string }[] = [
  {
    match: 'WB Colour Temp 5200K-5600K / Shift B0 M0',
    why: 'A Kelvin *range*, not a value. The camera takes one number and the page does not say which; picking one would be inventing a setting.',
  },
];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * "FL (Film Look)" -> code FL, label "Film Look".
 * The trailing digit is required — VV2 is a Look code and `[A-Z]+` misses it.
 */
const LOOK_RE = /^\s*([A-Z]{1,3}[0-9]?)\s*\(([^)]+)\)\s*$/;

const CL_KEYS = {
  Contrast: 'contrast',
  Highlights: 'highlights',
  Shadows: 'shadows',
  Fade: 'fade',
  Saturation: 'saturation',
  Sharpness: 'sharpness',
  'Sharpness Range': 'sharpnessRange',
  Clarity: 'clarity',
} as const;

/**
 * The page writes unsigned parameters with a leading `+` ("Sharpness Range +3")
 * even though the camera does not. `Number()` reads both, and the stored value
 * is a plain number — `format.ts` decides how it is displayed.
 */
function parseSettingsTokens(body: string): Record<string, number> {
  const out: Record<string, number> = {};
  // Longest key first, or "Sharpness" consumes "Sharpness Range".
  const keys = Object.keys(CL_KEYS).sort((a, b) => b.length - a.length);
  for (const token of body.split(',')) {
    const t = token.trim();
    if (!t) continue;
    const key = keys.find((k) => t.startsWith(k));
    if (!key) continue;
    const raw = t.slice(key.length).trim();
    const n = Number(raw);
    if (Number.isFinite(n)) out[CL_KEYS[key as keyof typeof CL_KEYS]] = n;
  }
  return out;
}

/**
 * Separator for splitting WB shift tokens off the base value. NUL can never
 * occur in the scraped text, so it is collision-proof — but it must be written as
 * an escape, never as a literal byte, or git classifies this file as binary
 * and stops producing diffs for it.
 */
const SHIFT_SEP = '\u0000';

/**
 * Pulls the White Balance clause out of the settings string.
 *
 * The page is inconsistent: "WB AWB", "AWB", "WB Colour Temp 5600K B4.0 M0.25",
 * "WB Cloudy A1.5, M0.5". Shift letters are space-separated here but
 * comma-separated in `parseWhiteBalance`, so the clause is normalised first.
 */
function extractWhiteBalance(body: string): { wb: WhiteBalance | null; rest: string } {
  const m = /(?:^|,)\s*(?:WB\s+)?((?:Colour Temp\s+)?[^,]*?(?:AWB|\d{3,4}K|Daylight|Shade|Cloudy|Incandescent|Fluor\.[^,]*|Flash|Underwater Auto)[^,]*(?:,\s*[GM]\d+(?:\.\d+)?)?)\s*$/i.exec(
    body,
  );
  if (!m) return { wb: null, rest: body };

  const clause = m[1]
    .replace(/^Colour Temp\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // "5600K B4.0 M0.25" / "Cloudy A1.5, M0.5" -> "5600K, B4.0-M0.25"
  const head = clause.replace(/[,\s]+([ABGM]\d+(?:\.\d+)?)/g, `${SHIFT_SEP}$1`);
  const [base, ...shifts] = head.split(SHIFT_SEP);
  const normalised = shifts.length ? `${base.trim()}, ${shifts.join('-')}` : base.trim();

  return { wb: parseWhiteBalance(normalised), rest: body.slice(0, m.index) };
}

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export type ImportResult = {
  recipes: (Recipe & { images: string[]; credit: Credit })[];
  /** EN description per recipe id, for the translations seed. */
  descriptions: Record<string, string>;
  skipped: { data: string; why: string }[];
  corrections: number;
  duplicates: number;
};

export type Credit = {
  photographer: string;
  country: string;
  avatar: string;
  notes: string;
  source: string;
};

const SOURCE_URL = 'https://www.sony-asia.com/microsite/rmdc/creativelooks/alpha-recipes/';

export function importSonyAsia(csv: string): ImportResult {
  const rows = parseCsv(csv);
  const skipped: ImportResult['skipped'] = [];
  const descriptions: Record<string, string> = {};
  let corrections = 0;
  let duplicates = 0;

  // Settings fingerprint -> index into `recipes`, so a photographer's carousel
  // collapses to one recipe carrying all of its photos.
  const seen = new Map<string, number>();
  const recipes: ImportResult['recipes'] = [];
  const usedSlugs = new Map<string, number>();

  for (const row of rows) {
    // Production notes are appended to `data` after a run of newlines, and are
    // also carried in their own columns. Removing them by value is reliable;
    // splitting on the blank line is not, because one row has a newline *inside*
    // its WB clause ("WB Colour\n\nTemp 5000K A3 G1") and that split truncated
    // the setting.
    const noteText = [row.data2, row.data4]
      .map((s) => (s ?? '').trim())
      .filter((s) => s.length > 3);

    let data = (row.data ?? '').trim();
    for (const note of noteText) data = data.split(note).join(' ');
    data = data.replace(/\s+/g, ' ').trim();
    if (!data) continue;

    const rejected = REJECTED.find((r) => data.includes(r.match));
    if (rejected) {
      skipped.push({ data, why: rejected.why });
      continue;
    }

    for (const c of SCRAPE_CORRECTIONS) {
      const re = new RegExp(c.from, 'g');
      if (re.test(data)) {
        data = data.replace(new RegExp(c.from, 'g'), c.to);
        corrections++;
      }
    }

    const [lookPart, ...settingsParts] = data.split('|');
    const lookMatch = LOOK_RE.exec(lookPart);
    if (!lookMatch) {
      skipped.push({ data, why: `could not read a Look code from "${lookPart.trim()}"` });
      continue;
    }
    const look = lookMatch[1];
    const lookLabel = lookMatch[2].trim();
    if (!(CREATIVE_LOOK_CODES as readonly string[]).includes(look)) {
      skipped.push({ data, why: `"${look}" is not one of the ten built-in Creative Looks` });
      continue;
    }

    const settingsBody = settingsParts.join('|').trim();

    // "Default Settings" cannot be turned into numbers. Sony's Creative Look
    // page (TP1000640837) documents what each Look *is* but publishes no
    // default value for any of the eight parameters — and `Sharpness Range`
    // starts at 1, so "all zeros" is not even a legal row. Writing a plausible
    // set here is exactly the invented camera value rule 1 forbids.
    if (/^default settings$/i.test(settingsBody)) {
      skipped.push({
        data,
        why: 'the page says only "Default Settings", and Sony publishes no per-Look default values to expand that into',
      });
      continue;
    }

    const { wb, rest } = extractWhiteBalance(settingsBody);
    if (!wb) {
      skipped.push({
        data,
        why: 'the page states no White Balance for this recipe, and White Balance is not a value to guess',
      });
      continue;
    }

    const mono = (CL_MONOCHROME_LOOKS as readonly string[]).includes(look);
    const tokens = parseSettingsTokens(rest);

    // Every parameter must be stated. A missing one is a gap in the source, not
    // a zero — `Contrast 0` and no Contrast token are different claims.
    const required = ['contrast', 'highlights', 'shadows', 'fade', 'sharpness', 'sharpnessRange', 'clarity'];
    const missing = required.filter((k) => tokens[k] === undefined);
    if (!mono && tokens.saturation === undefined) missing.push('saturation');
    if (missing.length) {
      skipped.push({ data, why: `the page does not state: ${missing.join(', ')}` });
      continue;
    }

    const settings: Record<string, unknown> = {
      look,
      contrast: tokens.contrast,
      highlights: tokens.highlights,
      shadows: tokens.shadows,
      fade: tokens.fade,
      sharpness: tokens.sharpness,
      sharpnessRange: tokens.sharpnessRange,
      clarity: tokens.clarity,
      ...(mono ? {} : { saturation: tokens.saturation }),
    };

    const rawPhotographer = (row.name ?? '').trim();
    const photographer = PHOTOGRAPHER_SPELLING[rawPhotographer] ?? (rawPhotographer || 'Sony');
    const country = (row.data3 ?? '').trim();

    // A recipe is its settings plus its balance. Two photographers landing on
    // the same numbers is possible but has not happened; the credit is part of
    // the fingerprint so it would not silently merge them if it did.
    const fingerprint = JSON.stringify([settings, wb, photographer]);

    const images = [row.image, row.image2, row.image3, row.image4, row.image5]
      .map((u) => (u ?? '').trim())
      .filter(Boolean);

    const existing = seen.get(fingerprint);
    if (existing !== undefined) {
      duplicates++;
      for (const img of images) {
        if (!recipes[existing].images.includes(img)) recipes[existing].images.push(img);
      }
      continue;
    }

    const id = `SCL-CL-${String(recipes.length + 1).padStart(3, '0')}`;

    const baseSlug = slugify(`${look} ${photographer}`) || slugify(look);
    const n = (usedSlugs.get(baseSlug) ?? 0) + 1;
    usedSlugs.set(baseSlug, n);
    const slug = n === 1 ? baseSlug : `${baseSlug}-${n}`;

    const displayName = `${lookLabel} · ${photographer}${n === 1 ? '' : ` ${n}`}`;

    const tags = [
      'creative-look',
      slugify(lookLabel),
      ...(country ? [slugify(country)] : []),
      ...(mono ? ['monochrome'] : []),

    ].filter(Boolean);

    const parsed = recipeSchema.safeParse({
      id,
      slug,
      name: `${id}: ${displayName}`,
      format: 'cl',
      whiteBalance: wb,
      settings,
      tags: [...new Set(tags)],
      published: true,
    });

    if (!parsed.success) {
      skipped.push({ data, why: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
      continue;
    }

    const notes = (row.data2 ?? '').replace(/\s+/g, ' ').trim();
    seen.set(fingerprint, recipes.length);
    recipes.push({
      ...parsed.data,
      images,
      credit: {
        photographer,
        country,
        avatar: (row.image11 ?? '').trim(),
        notes,
        source: SOURCE_URL,
      },
    });

    // Factual, not invented character prose: who shot it, where, on which Look,
    // plus whatever the page itself said about the shoot.
    descriptions[id] = [
      `${lookLabel} (${look}) Creative Look recipe by ${photographer}${country ? `, ${country}` : ''}, from Sony’s Alpha Recipes collection.`,
      formatNotes(row.data2 ?? ''),
    ]
      .filter(Boolean)
      .join(' ');
  }

  return { recipes, descriptions, skipped, corrections, duplicates };
}
