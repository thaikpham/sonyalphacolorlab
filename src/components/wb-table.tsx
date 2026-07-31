import { WB_EXPLANATIONS, WB_OVERVIEW, type Locale } from '@/lib/camera/explanations';
import { wbEffects, wbSummary } from '@/lib/camera/effects';
import type { WhiteBalance } from '@/lib/camera/schema';
import { wbHeadLabel } from '@/lib/camera/format';
import { ParamRow } from './settings-table';
import {
  getKelvinHexColor,
  getWbShiftAxisHexColor,
} from '@/lib/camera/color';

/**
 * Renders White Balance text readout with exact color coding per rules:
 * - Kelvin: < 4000K (Blue), 4100-5900K (White), >= 6000K (Orange)
 * - Shift A/B: A (Amber), B (Blue)
 * - Shift G/M: G (Green), M (Magenta)
 */
export function FormattedWb({ wb, className = '' }: { wb: WhiteBalance; className?: string }) {
  const kelvinStr = wbHeadLabel(wb);
  const kelvinHex = wb.mode === 'kelvin' ? getKelvinHexColor(wb.kelvin) : '#ffffff';

  const ab = wb.shift?.ab;
  const gm = wb.shift?.gm;

  return (
    <span className={`inline-flex items-center gap-1 font-sans font-bold tabular ${className}`}>
      <span style={{ color: kelvinHex }}>{kelvinStr}</span>
      {wb.shift && <span className="text-white/40 font-normal">, </span>}
      {ab && (
        <span style={{ color: getWbShiftAxisHexColor(ab.axis) }}>
          {ab.axis}{ab.amount}
        </span>
      )}
      {ab && gm && <span className="text-white/40 font-normal">-</span>}
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
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3.5">
        <span className="eyebrow !text-[0.5625rem]" style={{ color: 'oklch(72% 0.08 40)' }}>
          {SUMMARY_LABELS.net[locale]}
        </span>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink">{net[locale]}</p>
        {interplay && (
          <p className="mt-2 max-w-prose text-xs leading-relaxed text-ink-faint">
            <span aria-hidden className="mr-1.5 text-ink-muted">
              →
            </span>
            {interplay[locale]}
          </p>
        )}
      </div>

      <details className="group">
        <summary className="flex cursor-pointer items-baseline gap-1.5 list-none marker:content-none text-xs text-ink-muted transition-colors hover:text-ink">
          <span aria-hidden className="text-ink-faint">
            ·
          </span>
          {SUMMARY_LABELS.overview[locale]}
          <span aria-hidden className="text-ink-faint group-open:hidden">
            ?
          </span>
        </summary>
        <div className="mt-2 flex max-w-prose flex-col gap-2 border-l border-white/10 pl-3">
          {WB_OVERVIEW[locale].map((paragraph) => (
            <p key={paragraph} className="text-xs leading-relaxed text-ink-faint">
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
  const kelvinHex = wb.mode === 'kelvin' ? getKelvinHexColor(wb.kelvin) : '#ffffff';
  const ab = wb.shift?.ab;
  const gm = wb.shift?.gm;

  return (
    <div className="mt-1 border-t border-white/5 pt-1">
      <ParamRow
        locale={locale}
        label="Temperature"
        value={temperature}
        valueStyle={{ color: kelvinHex, fontWeight: 700 }}
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
      <WbConclusion wb={wb} locale={locale} />
    </div>
  );
}
