import {
  CL_PARAM_LABELS,
  CL_PARAM_ORDER,
  PP_COLOR_DEPTH_CHANNELS,
} from '@/lib/camera/constants';
import {
  CL_EXPLANATIONS,
  COLOR_DEPTH_EXPLANATIONS,
  PP_DETAIL_EXPLANATIONS,
  PP_EXPLANATIONS,
  type Locale,
} from '@/lib/camera/explanations';
import {
  AXIS_LABELS,
  clEffects,
  ppEffects,
  type Effect,
} from '@/lib/camera/effects';
import { formatClValue, signed } from '@/lib/camera/format';
import type { ClSettings, PpSettings } from '@/lib/camera/schema';

/**
 * A recipe's settings, as the camera lists them, with a third column saying
 * what each value is actually doing to the image.
 *
 * Two different kinds of help, deliberately kept apart:
 *   - The effect column is value-specific — "Blacks crushed hard" only makes
 *     sense because this recipe sets -7. It is the primary content.
 *   - The `?` disclosure is the general explanation of the parameter itself,
 *     folded away so the table still scans as a table.
 *
 * Labels and value formatting come from `constants.ts` / `format.ts`, never
 * retyped here — that is what keeps a Creative Look's unsigned `Fade` from
 * being rendered "+5" while Picture Profile's signed `Saturation` is "+25".
 *
 * Rows are NOT a `<dl>`. A `<details>` element is not valid inside one, and
 * nesting them there failed two axe audits (`definition-list`, `dlitem`).
 *
 * COLUMN WIDTHS ARE FIXED, NOT `auto`. Each row is its own grid — a `<details>`
 * cannot share tracks with its siblings — so `auto` sizing let every row
 * measure its own content and the three columns came out ragged down the page.
 * The widths below hold the longest real content in the catalogue:
 * "Hi-Light Detail" (15 chars, sans) and "Manual 92.5% +5" (15 chars, mono).
 */

/** Shared track definition. Every parameter row must use this to stay aligned. */
const ROW_GRID =
  'grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1.5 sm:grid-cols-[9rem_8.5rem_1fr]';

/** Axis tints. Muted on purpose — three of these per row must not shout. */
const AXIS_TINT: Record<Effect['axis'], string> = {
  contrast: 'oklch(72% 0.03 265)',
  color: 'oklch(72% 0.08 40)',
  detail: 'oklch(72% 0.05 160)',
};

import {
  getColorDepthChannelHexColor,
} from '@/lib/camera/color';

export function ParamRow({
  label,
  value,
  effect,
  explanation,
  locale,
  labelClassName,
  valueClassName,
  labelStyle,
  valueStyle,
}: {
  label: string;
  value: string;
  effect?: Effect;
  explanation?: string;
  locale: Locale;
  labelClassName?: string;
  valueClassName?: string;
  labelStyle?: React.CSSProperties;
  valueStyle?: React.CSSProperties;
}) {
  const head = (
    <>
      <span className={`text-sm ${labelClassName || 'text-ink-muted'}`} style={labelStyle}>{label}</span>
      <span className={`tabular text-sm sm:text-right ${valueClassName || 'text-ink'}`} style={valueStyle}>{value}</span>
    </>
  );

  const effectCell = effect ? (
    <span className="col-span-2 flex flex-col gap-0.5 sm:col-span-1 sm:pl-2">
      <span className="eyebrow !text-[0.5625rem]" style={{ color: AXIS_TINT[effect.axis] }}>
        {AXIS_LABELS[effect.axis][locale]}
      </span>
      <span className="text-xs leading-relaxed text-ink-faint">{effect[locale]}</span>
    </span>
  ) : null;

  if (!explanation) {
    return (
      <div className={`${ROW_GRID} border-b border-white/5 py-2.5 last:border-0`}>
        {head}
        {effectCell}
      </div>
    );
  }

  return (
    <details className="group border-b border-white/5 py-2.5 last:border-0">
      <summary className={`${ROW_GRID} cursor-pointer list-none marker:content-none`}>
        <span className="flex items-baseline gap-1.5">
          <span
            className={`text-sm ${labelClassName || 'text-ink-muted group-hover:text-ink transition-colors'}`}
            style={labelStyle}
          >
            {label}
          </span>
          <span aria-hidden className="text-ink-faint group-open:hidden">
            ?
          </span>
        </span>
        <span
          className={`tabular text-sm sm:text-right ${valueClassName || 'text-ink'}`}
          style={valueStyle}
        >
          {value}
        </span>
        {effectCell}
      </summary>
      <p className="mt-2 max-w-prose text-xs leading-relaxed text-ink-faint">{explanation}</p>
    </details>
  );
}

export function ParamBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass p-5">
      <h2 className="eyebrow mb-2">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export function PpTable({ s, locale = 'en' }: { s: PpSettings; locale?: Locale }) {
  const fx = ppEffects(s);
  const knee =
    s.knee.mode === 'Auto'
      ? `Auto${s.knee.maxPoint ? ` ${s.knee.maxPoint}%` : ''}${
          s.knee.sensitivity ? ` ${s.knee.sensitivity}` : ''
        }`
      : `Manual ${s.knee.point}% ${signed(s.knee.slope)}`;

  const e = (k: keyof typeof PP_EXPLANATIONS) => PP_EXPLANATIONS[k][locale];

  return (
    <div className="flex flex-col gap-4">
      <ParamBlock title="Picture Profile">
        <ParamRow locale={locale} label="Black Level" value={signed(s.blackLevel)} effect={fx.blackLevel} explanation={e('blackLevel')} />
        <ParamRow locale={locale} label="Gamma" value={s.gamma} effect={fx.gamma} explanation={e('gamma')} />
        <ParamRow
          locale={locale}
          label="Black Gamma"
          value={`${s.blackGamma.range} ${signed(s.blackGamma.level)}`}
          effect={fx.blackGamma}
          explanation={e('blackGamma')}
        />
        <ParamRow locale={locale} label="Knee" value={knee} effect={fx.knee} explanation={e('knee')} />
        <ParamRow locale={locale} label="Color Mode" value={s.colorMode} effect={fx.colorMode} explanation={e('colorMode')} />
        <ParamRow locale={locale} label="Saturation" value={signed(s.saturation)} effect={fx.saturation} explanation={e('saturation')} />
        <ParamRow locale={locale} label="Color Phase" value={signed(s.colorPhase)} effect={fx.colorPhase} explanation={e('colorPhase')} />
      </ParamBlock>

      <ParamBlock title="Color Depth">
        {PP_COLOR_DEPTH_CHANNELS.map((c) => {
          const hex = getColorDepthChannelHexColor(c);
          return (
            <ParamRow
              key={c}
              locale={locale}
              label={c}
              labelStyle={{ color: hex, fontWeight: 700 }}
              valueStyle={{ color: hex, fontWeight: 700 }}
              value={signed(s.colorDepth[c])}
              effect={fx[`colorDepth.${c}`]}
              explanation={COLOR_DEPTH_EXPLANATIONS[c][locale]}
            />
          );
        })}
      </ParamBlock>

      <ParamBlock title="Detail">
        <ParamRow locale={locale} label="Level" value={signed(s.detail.level)} effect={fx.detailLevel} explanation={PP_DETAIL_EXPLANATIONS.level[locale]} />
        <ParamRow locale={locale} label="Adjust" value={s.detail.mode} effect={fx.detailMode} explanation={PP_DETAIL_EXPLANATIONS.mode[locale]} />
        <ParamRow locale={locale} label="V/H Balance" value={signed(s.detail.vhBalance)} effect={fx.vhBalance} explanation={PP_DETAIL_EXPLANATIONS.vhBalance[locale]} />
        <ParamRow locale={locale} label="B/W Balance" value={s.detail.bwBalance} effect={fx.bwBalance} explanation={PP_DETAIL_EXPLANATIONS.bwBalance[locale]} />
        {/* Limit and Crispening are unsigned 0–7; no sign, by design. */}
        <ParamRow locale={locale} label="Limit" value={String(s.detail.limit)} effect={fx.detailLimit} explanation={PP_DETAIL_EXPLANATIONS.limit[locale]} />
        <ParamRow locale={locale} label="Crispening" value={String(s.detail.crispening)} effect={fx.crispening} explanation={PP_DETAIL_EXPLANATIONS.crispening[locale]} />
        <ParamRow locale={locale} label="Hi-Light Detail" value={String(s.detail.hiLightDetail)} effect={fx.hiLightDetail} explanation={PP_DETAIL_EXPLANATIONS.hiLightDetail[locale]} />
      </ParamBlock>
    </div>
  );
}

export function ClTable({ s, locale = 'en' }: { s: ClSettings; locale?: Locale }) {
  const fx = clEffects(s);

  return (
    <div className="flex flex-col gap-4">
      <ParamBlock title="Creative Look">
        <ParamRow locale={locale} label="Look" value={s.look} effect={fx.look} />
        {CL_PARAM_ORDER.map((p) => {
          const value = s[p];
          // Saturation is absent on BW and SE — the camera greys it out.
          if (value === undefined) return null;
          return (
            <ParamRow
              key={p}
              locale={locale}
              label={CL_PARAM_LABELS[p]}
              value={formatClValue(p, value)}
              effect={fx[p]}
              explanation={CL_EXPLANATIONS[p][locale]}
            />
          );
        })}
      </ParamBlock>
    </div>
  );
}
