/**
 * Prints the lexical search evaluation as a Markdown report.
 *
 *   npm run search:eval
 *
 * Offline and credential-free: it ranks the seed corpus with the production
 * ranker (`src/lib/search/rank.ts`). The thresholds live in
 * `src/lib/search/evaluation/evaluation.test.ts`; this is the readable table
 * behind them, for `docs/evaluations/`.
 */

import { evaluate } from '../src/lib/search/evaluation/evaluate';

const report = evaluate();
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const lines = [
  `| Metric | Value |`,
  `|---|---|`,
  `| Queries | ${report.counts.queries} (${report.counts.withPilot} against the pilot fixture) |`,
  `| Exact/alias top-1 | ${pct(report.exactTop1)} |`,
  `| Recall@5 | ${report.recallAt5.toFixed(3)} |`,
  `| MRR | ${report.mrr.toFixed(3)} |`,
  `| No-answer queries returning nothing | ${pct(report.noAnswerClean)} |`,
  '',
  `| # | Query | Locale | Type | Recall@5 | Top-1 ok | Top results |`,
  `|---|---|---|---|---|---|---|`,
  ...report.results.map((r, i) =>
    [
      i + 1,
      `\`${r.query.q}\`${r.query.corpus === 'with-pilot' ? ' †' : ''}`,
      r.query.locale,
      r.query.type,
      r.recall === null ? (r.emptyOk ? 'empty ✓' : 'NOT EMPTY') : r.recall.toFixed(2),
      r.top1Ok === null ? '—' : r.top1Ok ? 'yes' : 'NO',
      r.top.slice(0, 3).map((t) => `${t.id} (${t.reasons.join('+')})`).join('<br>') || '(none)',
    ].join(' | ').replace(/^/, '| ').concat(' |'),
  ),
  '',
  '† answered by a pilot draft; run against a corpus that includes the drafts.',
];

console.log(lines.join('\n'));
