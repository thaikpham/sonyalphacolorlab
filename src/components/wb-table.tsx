import { WB_EXPLANATIONS, WB_OVERVIEW, type Locale } from '@/lib/camera/explanations';
import { wbEffects, wbSummary } from '@/lib/camera/effects';
import type { WhiteBalance } from '@/lib/camera/schema';
import { wbHeadLabel } from '@/lib/camera/format';
import { ParamRow, ROW_STRIPES } from './settings-table';
import {
  getKelvinHexColor,
  getWbShiftAxisHexColor,
} from '@/lib/camera/color';

/**
 * White Balance as a text readout, colour-coded by what the dial actually does:
 * - Kelvin: < 4000K (blue), 4100-5900K (neutral), >= 6000K (orange)
 * - Shift A/B: A (amber), B (blue)
 * - Shift G/M: G (green), M (magenta)
 *
 * These are the one place amber and green survive the no-competitor-hue rule,
 * and they are not an exception to it: the rule governs colours the *interface*
 * chooses, and this is the recipe's own measured cast rendered as itself. An
 * A-shift is amber; drawing it in the accent would be drawing the wrong number.
 * Same category as `--accent`, which ColorLab also recomputes per recipe.
 *
 * The values come from `src/lib/camera/color.ts`, never from a literal here.
 */
export function FormattedWb({ wb, className = '' }: { wb: WhiteBalance; className?: string }) {
  const kelvinStr = wbHeadLabel(wb);
  const kelvinColor = wb.mode === 'kelvin' ? getKelvinHexColor(wb.kelvin) : 'var(--color-ink)';

  const ab = wb.shift?.ab;
  const gm = wb.shift?.gm;

  return (
    <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${className}`}>
      <span style={{ color: kelvinColor }}>{kelvinStr}</span>
      {wb.shift && <span className="font-normal text-ink-faint">, </span>}
      {ab && (
        <span style={{ color: getWbShiftAxisHexColor(ab.axis) }}>
          {ab.axis}{ab.amount}
        </span>
      )}
      {ab && gm && <span className="font-normal text-ink-faint">-</span>}
      {gm && (
        <span style={{ color: getWbShiftAxisHexColor(gm.axis) }}>
          {gm.axis}{gm.amount}
        </span>
      )}
    </span>
  );
}

/** UI chrome only. Parameter names stay English (rule 3); these are not names. */
const SUMMARY_LABELS = {
  net: { en: 'Overall tone', vi: 'Tông màu tổng thể' },
  overview: {
    en: 'How Temperature, A/B and G/M combine',
    vi: 'Temperature, A/B và G/M kết hợp thế nào',
  },
} as const;

/**
 * The payoff of the three rows above, and the primer explaining why they can
 * look like they contradict each other.
 *
 * Kept out of the rows on purpose. A `ParamRow` describes one dial, and the
 * combined cast is not any dial's property — stating it on the Temperature row
 * would be wrong the moment the A/B shift pulls the other way.
 */
function WbConclusion({ wb, locale }: { wb: WhiteBalance; locale: Locale }) {
  const { net, interplay } = wbSummary(wb);

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      <div className="row-tint p-3.5">
        <span className="label">{SUMMARY_LABELS.net[locale]}</span>
        <p className="mt-1 max-w-prose text-body-sm leading-relaxed text-ink">{net[locale]}</p>
        {interplay && (
          <p className="mt-2 max-w-prose text-meta leading-relaxed">
            <span aria-hidden className="mr-1.5 text-ink-muted">
              →
            </span>
            {interplay[locale]}
          </p>
        )}
      </div>

      <details className="group">
        <summary className="flex cursor-pointer items-baseline gap-1.5 list-none marker:content-none text-meta text-ink-muted transition-colors hover:text-ink">
          <span aria-hidden className="text-ink-faint">
            ·
          </span>
          {SUMMARY_LABELS.overview[locale]}
          <span aria-hidden className="text-ink-faint group-open:hidden">
            ?
          </span>
        </summary>
        {/* Indented rather than ruled. A vertical hairline down the left of a
            disclosure is the same stroke the rest of the system dropped. */}
        <div className="mt-2 ml-3 flex max-w-prose flex-col gap-2">
          {WB_OVERVIEW[locale].map((paragraph) => (
            <p key={paragraph} className="text-meta leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}

export function WbTable({ wb, locale = 'en' }: { wb: WhiteBalance; locale?: Locale }) {
  const fx = wbEffects(wb);

  const temperature = wbHeadLabel(wb);
  const kelvinColor = wb.mode === 'kelvin' ? getKelvinHexColor(wb.kelvin) : 'var(--color-ink)';
  const ab = wb.shift?.ab;
  const gm = wb.shift?.gm;

  return (
    /* Separated from the block above by a `.seam` — light that fades out at
       both ends — rather than the hairline that used to run edge to edge. */
    <div className="mt-1 pt-1">
      <hr className="seam mb-1" />
      {/* The three dial rows stripe as one run, exactly like a ParamBlock's —
          this table is not inside one, so it carries the rule itself. */}
      <div className={`flex flex-col ${ROW_STRIPES}`}>
      <ParamRow
        locale={locale}
        label="Temperature"
        value={temperature}
        valueStyle={{ color: kelvinColor, fontWeight: 700 }}
        effect={fx.temperature}
        explanation={WB_EXPLANATIONS.temperature[locale]}
      />
      {ab && (
        <ParamRow
          locale={locale}
          label="Shift A/B"
          value={`${ab.axis}${ab.amount}`}
          valueStyle={{ color: getWbShiftAxisHexColor(ab.axis), fontWeight: 700 }}
          effect={fx.shiftAb}
          explanation={WB_EXPLANATIONS.shiftAb[locale]}
        />
      )}
      {gm && (
        <ParamRow
          locale={locale}
          label="Shift G/M"
          value={`${gm.axis}${gm.amount}`}
          valueStyle={{ color: getWbShiftAxisHexColor(gm.axis), fontWeight: 700 }}
          effect={fx.shiftGm}
          explanation={WB_EXPLANATIONS.shiftGm[locale]}
        />
      )}
      </div>
      <WbConclusion wb={wb} locale={locale} />
    </div>
  );
}
