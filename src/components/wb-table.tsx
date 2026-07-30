import { WB_EXPLANATIONS, type Locale } from '@/lib/camera/explanations';
import { wbEffects } from '@/lib/camera/effects';
import type { WhiteBalance } from '@/lib/camera/schema';
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
  const kelvinStr = wb.mode === 'kelvin' ? `${wb.kelvin}K` : wb.auto;
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

export function WbTable({ wb, locale = 'en' }: { wb: WhiteBalance; locale?: Locale }) {
  const fx = wbEffects(wb);

  const temperature = wb.mode === 'kelvin' ? `${wb.kelvin}K` : wb.auto;
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
    </div>
  );
}
