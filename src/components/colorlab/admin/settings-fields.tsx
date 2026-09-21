'use client';

import { useTranslations } from 'next-intl';
import { Group, EnumSelect, Ranged } from './fields';
import {
  CL_MONOCHROME_LOOKS,
  CL_PARAM_LABELS,
  CL_RANGES,
  CL_SIGNED_PARAMS,
  CREATIVE_LOOKS,
  CREATIVE_LOOK_CODES,
  PP_BLACK_GAMMA_RANGE,
  PP_COLOR_DEPTH_CHANNELS,
  PP_COLOR_MODE,
  PP_DETAIL_BW_BALANCE,
  PP_DETAIL_MODE,
  PP_GAMMA,
  PP_KNEE_AUTO_SENSITIVITY,
  PP_KNEE_MODE,
  PP_RANGES,
} from '@/lib/camera/constants';
import type { ClSettings, PpSettings } from '@/lib/camera/schema';

/**
 * The two settings forms, one per format.
 *
 * They are separate components and not one form with a flag, for the same
 * reason `recipeSchema` is a discriminated union and Rule 2 says a recipe is
 * exactly one format: there is no recipe that has both a gamma curve and a
 * Look, and a shared form is where one grows a field belonging to the other.
 *
 * Every bound comes from `PP_RANGES` / `CL_RANGES`, every list from its
 * `constants.ts` tuple. Nothing here types a camera value.
 */

const LOOK_LABELS = Object.fromEntries(
  CREATIVE_LOOKS.map((l) => [l.code, `${l.code} · ${l.label}`]),
);

function KneeMode({
  value,
  onChange,
  label,
}: {
  value: 'Auto' | 'Manual';
  onChange: (mode: 'Auto' | 'Manual') => void;
  label: string;
}) {
  return <EnumSelect label={label} options={PP_KNEE_MODE} value={value} onChange={onChange} />;
}

export function PpFields({
  value,
  onChange,
}: {
  value: PpSettings;
  onChange: (next: PpSettings) => void;
}) {
  const t = useTranslations('recipeAdmin');
  const set = <K extends keyof PpSettings>(k: K, v: PpSettings[K]) =>
    onChange({ ...value, [k]: v });

  const auto = value.knee.mode === 'Auto' ? value.knee : { mode: 'Auto' as const };
  const manual =
    value.knee.mode === 'Manual'
      ? value.knee
      : {
          mode: 'Manual' as const,
          point: PP_RANGES.kneeManualPoint.min,
          slope: PP_RANGES.kneeManualSlope.min,
        };

  /* Switching mode replaces the whole object rather than merging: the two
     branches are a discriminated union with no field in common, and a merge
     would leave `point` sitting on an Auto knee for `strictObject` to refuse
     at save time. The defaults are range minima, legal by construction. */
  const onKnee = (mode: 'Auto' | 'Manual') => set('knee', mode === 'Auto' ? auto : manual);

  return (
    <div className="flex flex-col gap-6">
      <Group title={t('ppTone')}>
        <Ranged
          label={t('blackLevel')}
          range={PP_RANGES.blackLevel}
          value={value.blackLevel}
          onChange={(n) => set('blackLevel', n)}
          signed
        />
        <EnumSelect label={t('gamma')} options={PP_GAMMA} value={value.gamma} onChange={(v) => set('gamma', v)} />
        <EnumSelect
          label={t('blackGammaRange')}
          options={PP_BLACK_GAMMA_RANGE}
          value={value.blackGamma.range}
          onChange={(v) => set('blackGamma', { ...value.blackGamma, range: v })}
        />
        <Ranged
          label={t('blackGammaLevel')}
          range={PP_RANGES.blackGammaLevel}
          value={value.blackGamma.level}
          onChange={(n) => set('blackGamma', { ...value.blackGamma, level: n })}
          signed
        />
      </Group>

      {/* `knee` is narrowed once, here, and the narrowed value is what the
          callbacks close over. Reaching for `value.knee` inside a callback
          re-widens it to the union and every spread becomes unsound — the two
          branches share only `mode`. */}
      {value.knee.mode === 'Auto' ? (
        <Group title={t('ppKnee')}>
          <KneeMode value="Auto" onChange={onKnee} label={t('kneeMode')} />
          <Ranged
            label={t('kneeMaxPoint')}
            range={PP_RANGES.kneeAutoMaxPoint}
            value={value.knee.maxPoint ?? PP_RANGES.kneeAutoMaxPoint.min}
            onChange={(n) => set('knee', { ...auto, maxPoint: n })}
          />
          <EnumSelect
            label={t('kneeSensitivity')}
            options={PP_KNEE_AUTO_SENSITIVITY}
            value={value.knee.sensitivity ?? 'Mid'}
            onChange={(v) => set('knee', { ...auto, sensitivity: v })}
          />
        </Group>
      ) : (
        <Group title={t('ppKnee')}>
          <KneeMode value="Manual" onChange={onKnee} label={t('kneeMode')} />
          <Ranged
            label={t('kneePoint')}
            range={PP_RANGES.kneeManualPoint}
            value={value.knee.point}
            onChange={(n) => set('knee', { ...manual, point: n })}
          />
          <Ranged
            label={t('kneeSlope')}
            range={PP_RANGES.kneeManualSlope}
            value={value.knee.slope}
            onChange={(n) => set('knee', { ...manual, slope: n })}
            signed
          />
        </Group>
      )}

      <Group title={t('ppColour')}>
        <EnumSelect
          label={t('colorMode')}
          options={PP_COLOR_MODE}
          value={value.colorMode}
          onChange={(v) => set('colorMode', v)}
        />
        <Ranged
          label={t('ppSaturation')}
          range={PP_RANGES.saturation}
          value={value.saturation}
          onChange={(n) => set('saturation', n)}
          hint={t('ppSaturationHint')}
          signed
        />
        <Ranged
          label={t('colorPhase')}
          range={PP_RANGES.colorPhase}
          value={value.colorPhase}
          onChange={(n) => set('colorPhase', n)}
          signed
        />
        {PP_COLOR_DEPTH_CHANNELS.map((c) => (
          <Ranged
            key={c}
            label={t('colorDepth', { channel: c })}
            range={PP_RANGES.colorDepth}
            value={value.colorDepth[c]}
            onChange={(n) => set('colorDepth', { ...value.colorDepth, [c]: n })}
            signed
          />
        ))}
      </Group>

      <Group title={t('ppDetail')}>
        <Ranged
          label={t('detailLevel')}
          range={PP_RANGES.detailLevel}
          value={value.detail.level}
          onChange={(n) => set('detail', { ...value.detail, level: n })}
          signed
        />
        <EnumSelect
          label={t('detailMode')}
          options={PP_DETAIL_MODE}
          value={value.detail.mode}
          onChange={(v) => set('detail', { ...value.detail, mode: v })}
        />
        <Ranged
          label={t('detailVhBalance')}
          range={PP_RANGES.detailVhBalance}
          value={value.detail.vhBalance}
          onChange={(n) => set('detail', { ...value.detail, vhBalance: n })}
          signed
        />
        <EnumSelect
          label={t('detailBwBalance')}
          options={PP_DETAIL_BW_BALANCE}
          value={value.detail.bwBalance}
          onChange={(v) => set('detail', { ...value.detail, bwBalance: v })}
        />
        <Ranged
          label={t('detailLimit')}
          range={PP_RANGES.detailLimit}
          value={value.detail.limit}
          onChange={(n) => set('detail', { ...value.detail, limit: n })}
        />
        <Ranged
          label={t('detailCrispening')}
          range={PP_RANGES.detailCrispening}
          value={value.detail.crispening}
          onChange={(n) => set('detail', { ...value.detail, crispening: n })}
        />
        <Ranged
          label={t('detailHiLightDetail')}
          range={PP_RANGES.detailHiLightDetail}
          value={value.detail.hiLightDetail}
          onChange={(n) => set('detail', { ...value.detail, hiLightDetail: n })}
        />
      </Group>
    </div>
  );
}

export function ClFields({
  value,
  onChange,
}: {
  value: ClSettings;
  onChange: (next: ClSettings) => void;
}) {
  const t = useTranslations('recipeAdmin');
  const mono = (CL_MONOCHROME_LOOKS as readonly string[]).includes(value.look);
  const signed = (k: string) => (CL_SIGNED_PARAMS as readonly string[]).includes(k);
  const set = <K extends keyof ClSettings>(k: K, v: ClSettings[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="flex flex-col gap-6">
      <Group title={t('clLook')}>
        <EnumSelect
          label={t('look')}
          options={CREATIVE_LOOK_CODES}
          labels={LOOK_LABELS}
          value={value.look}
          /* Changing to a monochrome Look drops saturation, and changing back
             restores it — the schema refuses the field on BW/SE and requires
             it everywhere else, so leaving it in place would make the form
             unsaveable with no visible cause. */
          onChange={(look) => {
            const nowMono = (CL_MONOCHROME_LOOKS as readonly string[]).includes(look);
            if (nowMono) {
              const { saturation: _drop, ...rest } = value;
              onChange({ ...rest, look });
            } else {
              onChange({ ...value, look, saturation: value.saturation ?? 0 });
            }
          }}
          hint={mono ? t('monoHint') : undefined}
        />
      </Group>

      {/* Parameter labels are Sony's own terms and are never translated, so
          they come from `constants.ts` and not from the catalogue. */}
      <Group title={t('clAdjust')}>
        {(['contrast', 'highlights', 'shadows', 'fade'] as const).map((k) => (
          <Ranged
            key={k}
            label={CL_PARAM_LABELS[k]}
            range={CL_RANGES[k]}
            value={value[k]}
            onChange={(n) => set(k, n)}
            signed={signed(k)}
          />
        ))}
        {!mono && (
          <Ranged
            label={CL_PARAM_LABELS.saturation}
            range={CL_RANGES.saturation}
            value={value.saturation ?? 0}
            onChange={(n) => set('saturation', n)}
            hint={t('clSaturationHint')}
            signed
          />
        )}
        {(['sharpness', 'sharpnessRange', 'clarity'] as const).map((k) => (
          <Ranged
            key={k}
            label={CL_PARAM_LABELS[k]}
            range={CL_RANGES[k]}
            value={value[k]}
            onChange={(n) => set(k, n)}
            signed={signed(k)}
          />
        ))}
      </Group>
    </div>
  );
}
