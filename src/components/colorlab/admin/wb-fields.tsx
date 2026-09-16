'use client';

import { useTranslations } from 'next-intl';
import { EnumSelect, Group, Ranged } from './fields';
import {
  WB_AUTO_MODES,
  WB_AXIS_AB,
  WB_AXIS_GM,
  WB_KELVIN,
  WB_PRESETS,
  WB_SHIFT_AXIS,
} from '@/lib/camera/constants';
import type { WhiteBalance } from '@/lib/camera/schema';

/**
 * White balance, which is three modes and not two (AGENTS.md Rule 1b).
 *
 * Kelvin, an Auto mode, and a light-source preset are alternatives — the
 * schema is a discriminated union and the table has a CHECK that exactly one
 * of `wb_kelvin` / `wb_auto` / `wb_preset` is set. So switching mode replaces
 * the object; it never merges, or a recipe would carry a Kelvin number the
 * camera is not using.
 *
 * The shift is separate from all three, because all three take one. Each axis
 * is independently present or absent, and the schema refuses a shift object
 * with neither — so clearing the last axis clears the shift entirely rather
 * than leaving `{}` behind for the save to reject.
 */

const MODES = ['kelvin', 'auto', 'preset'] as const;

export function WhiteBalanceFields({
  value,
  onChange,
}: {
  value: WhiteBalance;
  onChange: (next: WhiteBalance) => void;
}) {
  const t = useTranslations('recipeAdmin');
  const shift = value.shift;

  const setShift = (next: WhiteBalance['shift']) => {
    /* `{}` is not a legal shift — `wbShiftSchema` requires at least one axis —
       so an empty one becomes absent rather than being sent for Zod to refuse
       with a message about a refinement. */
    const empty = !next?.ab && !next?.gm;
    onChange({ ...value, shift: empty ? undefined : next });
  };

  return (
    <div className="flex flex-col gap-6">
      <Group title={t('wb')}>
        <EnumSelect
          label={t('wbMode')}
          options={MODES}
          labels={{ kelvin: t('wbKelvinMode'), auto: t('wbAutoMode'), preset: t('wbPresetMode') }}
          value={value.mode}
          onChange={(mode) => {
            const tail = shift ? { shift } : {};
            if (mode === 'kelvin') onChange({ mode: 'kelvin', kelvin: WB_KELVIN.min, ...tail });
            else if (mode === 'auto') onChange({ mode: 'auto', auto: WB_AUTO_MODES[0], ...tail });
            else onChange({ mode: 'preset', preset: WB_PRESETS[0], ...tail });
          }}
        />

        {value.mode === 'kelvin' ? (
          <Ranged
            label={t('wbKelvin')}
            range={WB_KELVIN}
            value={value.kelvin}
            onChange={(n) => onChange({ ...value, kelvin: n })}
          />
        ) : value.mode === 'auto' ? (
          <EnumSelect
            label={t('wbAuto')}
            options={WB_AUTO_MODES}
            value={value.auto}
            onChange={(v) => onChange({ ...value, auto: v })}
          />
        ) : (
          <EnumSelect
            label={t('wbPreset')}
            options={WB_PRESETS}
            value={value.preset}
            onChange={(v) => onChange({ ...value, preset: v })}
            hint={t('wbPresetHint')}
          />
        )}
      </Group>

      <Group title={t('wbShift')}>
        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={Boolean(shift?.ab)}
            onChange={(e) =>
              setShift({
                ...shift,
                ab: e.target.checked ? { axis: 'B', amount: WB_SHIFT_AXIS.min } : undefined,
              })
            }
          />
          <span className="text-body-sm text-ink">{t('wbShiftAb')}</span>
        </label>
        {shift?.ab ? (
          <>
            <EnumSelect
              label={t('wbAxis')}
              options={WB_AXIS_AB}
              value={shift.ab.axis}
              onChange={(axis) => setShift({ ...shift, ab: { ...shift.ab!, axis } })}
            />
            <Ranged
              label={t('wbAmount')}
              range={WB_SHIFT_AXIS}
              value={shift.ab.amount}
              onChange={(amount) => setShift({ ...shift, ab: { ...shift.ab!, amount } })}
            />
          </>
        ) : null}

        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={Boolean(shift?.gm)}
            onChange={(e) =>
              setShift({
                ...shift,
                gm: e.target.checked ? { axis: 'M', amount: WB_SHIFT_AXIS.min } : undefined,
              })
            }
          />
          <span className="text-body-sm text-ink">{t('wbShiftGm')}</span>
        </label>
        {shift?.gm ? (
          <>
            <EnumSelect
              label={t('wbAxis')}
              options={WB_AXIS_GM}
              value={shift.gm.axis}
              onChange={(axis) => setShift({ ...shift, gm: { ...shift.gm!, axis } })}
            />
            <Ranged
              label={t('wbAmount')}
              range={WB_SHIFT_AXIS}
              value={shift.gm.amount}
              onChange={(amount) => setShift({ ...shift, gm: { ...shift.gm!, amount } })}
            />
          </>
        ) : null}
      </Group>
    </div>
  );
}
