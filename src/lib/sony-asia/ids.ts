/**
 * The id and slug each Sony Asia recipe was first published under, keyed by
 * what the recipe is (`recipeKey()` in `import.ts`).
 *
 * `data/translations.vi.json` and `data/sony-asia-credits.json` are keyed by
 * the id, and `push:supabase` never overwrites a row it already has. Ids lost
 * their `SCL-` prefix on 2026-10-24 and kept their number (`SCL-CL-013` →
 * `CL-013`). The slug here is the one each recipe was first published under;
 * the seed's slug is the code since 2026-10-28 (`cl-013`), and the rows here
 * on 2026-10-24 have this one frozen as the oldest spelling in
 * `data/slug-moves/`, so its links still land. A row added after was never
 * published under the slug here, and has no former slug. Numbering by row order meant one skipped
 * row becoming importable shifted every later id — and the hand-written
 * Vietnamese prose then named the wrong photographer on all of them.
 *
 * APPEND-ONLY. A recipe the importer has no entry for gets the next free id
 * and is listed in `ImportResult.unpinned`; `import.test.ts` fails until it is
 * pinned here. Never renumber, and never reuse an id or slug: an entry whose
 * recipe the page no longer shows stays, so its URL is never handed to another
 * recipe. If a correction changes a pinned recipe's settings, its key stops
 * matching and the test names it — re-key the entry, keep its id.
 *
 * Key: photographer · Look, then Contrast, Highlights, Shadows, Fade,
 * Saturation (– on a monochrome Look), Sharpness, Sharpness Range, Clarity ·
 * White Balance.
 */
export type PinnedId = { id: string; slug: string };

export const SONY_ASIA_IDS: Record<string, PinnedId> = {
  'Raoul Rutnam · FL +5 -9 +3 3 +3 4 5 4 · AWB': { id: 'CL-001', slug: 'fl-raoul-rutnam' },
  'Arantha Sirimanne · FL +3 -3 +1 1 -2 2 3 3 · Cloudy, A1.5-M0.5': { id: 'CL-002', slug: 'fl-arantha-sirimanne' },
  'Ravi Ranasinghe · VV2 0 0 0 0 0 4 3 8 · AWB': { id: 'CL-003', slug: 'vv2-ravi-ranasinghe' },
  'Sony Asia · VV2 -3 0 +2 4 0 4 3 1 · 5600K': { id: 'CL-004', slug: 'vv2-sony-asia' },
  'Jonpoon.jpg · VV2 +1 +1 +2 1 0 4 4 8 · AWB, A1-G1': { id: 'CL-005', slug: 'vv2-jonpoon-jpg' },
  'Jonpoon.jpg · VV2 +2 +4 +2 0 +2 4 3 8 · Daylight': { id: 'CL-006', slug: 'vv2-jonpoon-jpg-2' },
  'Khong ខុង · VV 0 0 0 0 0 4 3 1 · Daylight': { id: 'CL-007', slug: 'vv-khong' },
  'Filmreel · VV 0 0 0 0 0 4 3 1 · 5000K': { id: 'CL-008', slug: 'vv-filmreel' },
  'Sandeeshwara Perera · ST -7 +9 -9 0 +1 3 3 0 · 5500K, B2.5-G1.5': { id: 'CL-009', slug: 'st-sandeeshwara-perera' },
  'Ravi Ranasinghe · ST -2 0 0 0 0 4 3 1 · AWB': { id: 'CL-010', slug: 'st-ravi-ranasinghe' },
  'Khong ខុង · ST 0 0 0 0 0 4 3 1 · Daylight': { id: 'CL-011', slug: 'st-khong' },
  'Filmreel · ST -4 -7 +4 0 +4 0 3 0 · 6000K': { id: 'CL-012', slug: 'st-filmreel' },
  'Sony Asia · SH -2 -5 +4 5 0 5 3 1 · 5600K, A3.5-G3': { id: 'CL-013', slug: 'sh-sony-asia' },
  'Jonpoon.jpg · SH 0 -5 -3 2 +3 3 2 3 · 4700K, A6-G1.75': { id: 'CL-014', slug: 'sh-jonpoon-jpg' },
  'Puy · SH +1 -5 0 6 0 4 3 1 · AWB': { id: 'CL-015', slug: 'sh-puy' },
  'Jomnot · SH 0 0 0 6 0 4 3 1 · AWB': { id: 'CL-016', slug: 'sh-jomnot' },
  'Satheeshan Thiyagaraja · SE -3 -7 -6 0 – 4 3 3 · AWB': { id: 'CL-017', slug: 'se-satheeshan-thiyagaraja' },
  'Ravi Ranasinghe · SE -6 -4 -4 0 – 6 5 1 · AWB': { id: 'CL-018', slug: 'se-ravi-ranasinghe' },
  'Sandeeshwara Perera · PT 0 -5 +5 2 +2 3 3 0 · 5500K, A1-G2': { id: 'CL-019', slug: 'pt-sandeeshwara-perera' },
  'Eranga Siriwardhana · IN 0 0 0 3 0 4 3 1 · AWB': { id: 'CL-020', slug: 'in-eranga-siriwardhana' },
  'Sony Asia · IN -3 -5 +6 1 0 4 3 1 · 6500K, B2.5-M5': { id: 'CL-021', slug: 'in-sony-asia' },
  'Sony Asia · IN -3 +1 +4 1 0 4 3 1 · 5600K, B4-M0.25': { id: 'CL-022', slug: 'in-sony-asia-2' },
  'Jonpoon.jpg · IN +1 -5 +1 2 +1 2 2 1 · AWB, A1-G1': { id: 'CL-023', slug: 'in-jonpoon-jpg' },
  'Check In Siemreap ដើរលេងសៀមរាប · IN +2 -3 +3 2 +1 2 2 1 · 5000K, A3-G1': { id: 'CL-024', slug: 'in-check-in-siemreap' },
  'Sandeeshwara Perera · FL +2 +4 +4 0 0 4 3 1 · 5200K, A4-M3': { id: 'CL-025', slug: 'fl-sandeeshwara-perera' },
  'Sandeeshwara Perera · FL 0 -5 +4 0 +1 4 3 0 · 5900K, A3-M3.25': { id: 'CL-026', slug: 'fl-sandeeshwara-perera-2' },
  'Sandeeshwara Perera · FL +2 -8 -5 1 0 4 3 1 · 5200K, A1-M1.25': { id: 'CL-027', slug: 'fl-sandeeshwara-perera-3' },
  'Lahiru Rumesh · FL +2 -7 0 1 -1 4 3 2 · 7600K, A1-G1.25': { id: 'CL-028', slug: 'fl-lahiru-rumesh' },
  'Isuru Mudalige · FL -5 -4 -5 0 +6 8 2 5 · AWB': { id: 'CL-029', slug: 'fl-isuru-mudalige' },
  'Sony Asia · FL -3 0 +2 4 0 4 3 1 · 5600K': { id: 'CL-030', slug: 'fl-sony-asia' },
  'Sony Asia · FL +2 -5 -3 2 -1 4 3 3 · 5600K, A2.5-G2.5': { id: 'CL-031', slug: 'fl-sony-asia-2' },
  'Jonpoon.jpg · FL 0 -5 -3 2 +3 2 2 3 · 4700K, A6-G1.75': { id: 'CL-032', slug: 'fl-jonpoon-jpg' },
  'Mardy Suong · FL 0 0 0 0 0 4 3 1 · Daylight': { id: 'CL-033', slug: 'fl-mardy-suong' },
  'Mardy Suong · FL 0 0 0 0 0 4 3 1 · AWB': { id: 'CL-034', slug: 'fl-mardy-suong-2' },
  'Khong ខុង · FL +1 +1 -4 0 -1 5 3 2 · AWB': { id: 'CL-035', slug: 'fl-khong' },
  'Hea Kimhong ហ៊ាន គីមហុង · FL 0 +2 0 0 0 4 3 1 · 5000K, A3-G1': { id: 'CL-036', slug: 'fl-hea-kimhong' },
  'Filmreel · FL -4 -7 +4 0 +4 0 3 0 · 6500K': { id: 'CL-037', slug: 'fl-filmreel' },
};
