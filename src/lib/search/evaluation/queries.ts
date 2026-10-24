/**
 * The lexical search evaluation set (ADR 0003, brief §14.2).
 *
 * Every expected id is a real one: a recipe id from `data/recipes.seed.json`,
 * a product id from the catalogue seeds, an article id from `articles.ts`, or
 * a glossary entry generated from `explanations.ts`. Queries whose answer is
 * one of the pilot reference pages are marked `corpus: 'with-pilot'` — those
 * pages are drafts, so those queries run against a corpus that includes them,
 * and their results say nothing about what production returns today.
 *
 * Labels were set by reading the documents, not by running the ranker and
 * copying its output. A query the ranker gets wrong stays in, wrong — that is
 * what the metric is for. The owner should review the labels (brief §14.2:
 * "nhãn do người review chốt"); until then they are this session's judgement.
 */

export type EvalQueryType =
  | 'exact'
  | 'alias'
  | 'typo'
  | 'vi-accent'
  | 'vi-plain'
  | 'problem'
  | 'concept'
  | 'mood'
  | 'none'

export type EvalQuery = {
  readonly q: string
  readonly locale: 'en' | 'vi'
  readonly type: EvalQueryType
  /** Ids a reviewer would accept in the top five. Empty: no answer exists. */
  readonly relevant: readonly string[]
  /** Must be the first result (names, ids, aliases). */
  readonly top1?: string
  readonly corpus?: 'published' | 'with-pilot'
}

export const EVAL_QUERIES: readonly EvalQuery[] = [
  // --- exact names and ids --------------------------------------------
  { q: 'Mojave Sun', locale: 'vi', type: 'exact', relevant: ['SCL-PP-001'], top1: 'SCL-PP-001' },
  { q: 'Urban Teal', locale: 'en', type: 'exact', relevant: ['SCL-PP-009'], top1: 'SCL-PP-009' },
  { q: 'SCL-CL-017', locale: 'vi', type: 'exact', relevant: ['SCL-CL-017'], top1: 'SCL-CL-017' },
  { q: 'scl pp 009', locale: 'vi', type: 'exact', relevant: ['SCL-PP-009'], top1: 'SCL-PP-009' },
  { q: 'ILCE-7CM2', locale: 'vi', type: 'exact', relevant: ['sony-ilce-7cm2-sqap2'], top1: 'sony-ilce-7cm2-sqap2' },
  { q: 'ZV-E10', locale: 'vi', type: 'exact', relevant: ['sony-zv-e10-bq-ap2'], top1: 'sony-zv-e10-bq-ap2' },
  { q: 'WH-1000XM6', locale: 'en', type: 'exact', relevant: ['sony-wh-1000xm6'], top1: 'sony-wh-1000xm6' },
  { q: 'Color Depth R', locale: 'vi', type: 'exact', relevant: ['glossary-pp-colorDepth-R'], top1: 'glossary-pp-colorDepth-R' },
  { q: 'Knee', locale: 'en', type: 'exact', relevant: ['glossary-pp-knee'], top1: 'glossary-pp-knee' },
  { q: 'V/H Balance', locale: 'vi', type: 'exact', relevant: ['glossary-pp-detail-vhBalance'], top1: 'glossary-pp-detail-vhBalance' },
  { q: 'ISO Auto Min SS', locale: 'vi', type: 'exact', relevant: ['iso-auto-min-ss'], top1: 'iso-auto-min-ss' },
  // The code a recipe's name now starts with (`PP-009-Teal Muted Street`).
  { q: 'PP-009', locale: 'vi', type: 'exact', relevant: ['SCL-PP-009'], top1: 'SCL-PP-009' },
  { q: 'cl 013', locale: 'en', type: 'exact', relevant: ['SCL-CL-013'], top1: 'SCL-CL-013' },

  // --- aliases (derived from SKUs and names, never typed) ---------------
  { q: 'a7cii', locale: 'vi', type: 'alias', relevant: ['sony-ilce-7cm2-sqap2'], top1: 'sony-ilce-7cm2-sqap2' },
  { q: 'A7C II', locale: 'en', type: 'alias', relevant: ['sony-ilce-7cm2-sqap2'], top1: 'sony-ilce-7cm2-sqap2' },
  { q: 'a7r5', locale: 'vi', type: 'alias', relevant: ['sony-ilce-7rm5-bqap2'], top1: 'sony-ilce-7rm5-bqap2' },
  { q: 'alpha 7 iv', locale: 'en', type: 'alias', relevant: ['sony-ilce-7m4-bq-ap2'], top1: 'sony-ilce-7m4-bq-ap2' },
  { q: 'fx3', locale: 'vi', type: 'alias', relevant: ['sony-ilme-fx3a-q-ap2'], top1: 'sony-ilme-fx3a-q-ap2' },

  // --- typos ------------------------------------------------------------
  { q: 'mojav sun', locale: 'vi', type: 'typo', relevant: ['SCL-PP-001'] },
  { q: 'urban teel', locale: 'en', type: 'typo', relevant: ['SCL-PP-009'] },
  { q: 'vintge slide', locale: 'en', type: 'typo', relevant: ['SCL-PP-015'] },
  { q: 'kyotto jade', locale: 'vi', type: 'typo', relevant: ['SCL-PP-002'] },

  // --- Vietnamese with and without diacritics ---------------------------
  { q: 'lấy nét bằng ngón tay cái', locale: 'vi', type: 'vi-accent', relevant: ['back-button-af'], top1: 'back-button-af' },
  { q: 'lay net bang ngon tay cai', locale: 'vi', type: 'vi-plain', relevant: ['back-button-af'], top1: 'back-button-af' },
  { q: 'tai nghe chống ồn', locale: 'vi', type: 'vi-accent', relevant: ['sony-wh-1000xm6', 'sony-inzone-buds', 'sony-wf-lc900'] },
  { q: 'tai nghe chong on', locale: 'vi', type: 'vi-plain', relevant: ['sony-wh-1000xm6', 'sony-inzone-buds', 'sony-wf-lc900'] },
  { q: 'loa karaoke', locale: 'vi', type: 'vi-plain', relevant: ['sony-srs-xv500', 'sony-srs-xv800', 'sony-ult-tower-10'] },

  // --- a problem, not a name --------------------------------------------
  { q: 'ảnh trong nhà bị nhòe', locale: 'vi', type: 'problem', relevant: ['iso-auto-min-ss'], top1: 'iso-auto-min-ss' },
  { q: 'background bị cháy khi chụp flash', locale: 'vi', type: 'problem', relevant: ['body-ev-vs-flash-ev-sony-flash-ttl'] },
  { q: 'chủ thể bị mất nét khi có người đi qua', locale: 'vi', type: 'problem', relevant: ['back-button-af'] },
  { q: 'tốc độ màn trập tối thiểu', locale: 'vi', type: 'problem', relevant: ['iso-auto-min-ss'] },

  // --- a concept --------------------------------------------------------
  { q: 'creative look', locale: 'vi', type: 'concept', relevant: ['glossary-cl', 'picture-profile-va-creative-look'], corpus: 'with-pilot' },
  { q: 'saturation', locale: 'en', type: 'concept', relevant: ['glossary-pp-saturation', 'glossary-cl-saturation'] },
  { q: 'black level', locale: 'vi', type: 'concept', relevant: ['glossary-pp-blackLevel'] },
  { q: 'white balance shift', locale: 'vi', type: 'concept', relevant: ['white-balance-shift', 'glossary-wb-shiftAb', 'glossary-wb-shiftGm'], corpus: 'with-pilot' },
  { q: 'color depth', locale: 'vi', type: 'concept', relevant: ['color-depth', 'glossary-pp-colorDepth'], corpus: 'with-pilot' },
  { q: 'S-Cinetone', locale: 'en', type: 'concept', relevant: ['SCL-PP-027'] },

  // --- a mood or a scene -------------------------------------------------
  /* The night queries return with the originals (Neon Night, Bến Thành
     Night, Sài Gòn Café) once they are published; no published recipe answers
     them today, and a label with no document behind it is a label from the
     ranker. */
  { q: 'warm golden hour', locale: 'en', type: 'mood', relevant: ['SCL-PP-001'] },
  { q: 'sepia look', locale: 'en', type: 'mood', relevant: ['SCL-CL-017', 'SCL-CL-018'] },
  // The mood words of a name (`PP-009-Teal Muted Street`, `CL-013-Airy Warm
  // Pastel`): the only published recipes whose names hold both words.
  { q: 'teal muted', locale: 'en', type: 'mood', relevant: ['SCL-PP-009'] },
  { q: 'airy pastel', locale: 'vi', type: 'mood', relevant: ['SCL-CL-013'] },

  // --- a situation, a style or a tone, by its browse label -----------------
  // Labelled from the taxonomy the documents carry (`data/recipe-taxonomy.json`
  // plus `deriveTaxonomy`), not from the ranker: every recipe that browses
  // under the word is relevant, and Recall@5 asks for any five of them.
  {
    q: 'chan dung',
    locale: 'vi',
    type: 'vi-plain',
    relevant: ['SCL-PP-002', 'SCL-PP-015', 'SCL-PP-027', 'SCL-PP-045', 'SCL-PP-046', 'SCL-CL-013', 'SCL-CL-014', 'SCL-CL-015', 'SCL-CL-016', 'SCL-CL-019'],
  },
  {
    q: 'cafe',
    locale: 'vi',
    type: 'mood',
    relevant: ['SCL-PP-001', 'SCL-CL-001', 'SCL-CL-013', 'SCL-CL-014', 'SCL-CL-015', 'SCL-CL-016', 'SCL-CL-020', 'SCL-CL-021', 'SCL-CL-022', 'SCL-CL-023', 'SCL-CL-024', 'SCL-CL-030'],
  },
  {
    q: 'phim',
    locale: 'vi',
    type: 'mood',
    relevant: ['SCL-PP-001', 'SCL-PP-002', 'SCL-PP-009', 'SCL-PP-015', 'SCL-PP-044', 'SCL-CL-001', 'SCL-CL-002', 'SCL-CL-017', 'SCL-CL-018', 'SCL-CL-020', 'SCL-CL-021', 'SCL-CL-022', 'SCL-CL-023', 'SCL-CL-024', 'SCL-CL-025', 'SCL-CL-026', 'SCL-CL-027', 'SCL-CL-028', 'SCL-CL-029', 'SCL-CL-030', 'SCL-CL-031', 'SCL-CL-032', 'SCL-CL-033', 'SCL-CL-034', 'SCL-CL-035', 'SCL-CL-036', 'SCL-CL-037'],
  },
  {
    q: 'đen trắng',
    locale: 'vi',
    type: 'vi-accent',
    relevant: ['SCL-CL-017', 'SCL-CL-018'],
  },

  // --- nothing to find ---------------------------------------------------
  { q: 'xqzvbnmw', locale: 'vi', type: 'none', relevant: [] },
  { q: 'zzzz 12345', locale: 'en', type: 'none', relevant: [] },
  { q: 'canon eos r5', locale: 'en', type: 'none', relevant: [] },
]
