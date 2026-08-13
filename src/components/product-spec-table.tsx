import { getTranslations } from 'next-intl/server';
import { SPEC_ROWS, type ProductSpecs } from '@/lib/cameras/types';
import { translateSpecValue } from '@/lib/cameras/spec-values';

/**
 * The spec table, shared by every product route.
 *
 * One component because the row order, the labels and the "not published"
 * treatment must be identical on `/cameras/[id]` and `/audio/[id]`. They were
 * one function private to the camera route, which is how the catalogue modal
 * and the product page drifted apart the first time — see the note on
 * `SPEC_ROWS`.
 *
 * A Server Component: it reads the message catalogue directly and renders no
 * interactivity, so none of it needs to reach the browser.
 */
export async function ProductSpecTable({
  specs,
  locale,
}: {
  specs: ProductSpecs;
  locale: string;
}) {
  const t = await getTranslations('cameras');
  const row = specs as unknown as Record<string, string | null>;

  /* An unstated spec renders as "not published" rather than as "N/A" or a
     hidden row. The gap is information: this data comes from sources that vary
     in completeness, and a placeholder that reads like a value hides which of
     the two it is. */
  const rows = SPEC_ROWS[specs.kind].map((key) => [key, row[key] ?? null] as const);
  const extra = specs.kind === 'accessory' ? specs.keySpecs : [];

  return (
    <div className="bg-[#1c1d22] p-5 rounded-2xl border border-white/15 shadow-lg flex flex-col gap-3">
      <h3 className="font-extrabold text-sm uppercase text-sky-300 font-mono tracking-wider flex items-center gap-2">
        📊 {t('specs.specsHeading')}
      </h3>

      {/* A fixed label track, with the value starting where the label ends.
          `justify-between` pinned the value to the far right edge, so on a wide
          screen a two-word label and a two-word value sat ~1100px apart with
          nothing between them and the eye had to travel the gap on every row. */}
      <dl className="flex flex-col border border-white/10 rounded-xl overflow-hidden divide-y divide-white/10 text-xs">
        {extra.map((s) => (
          <div
            key={s.label}
            className="grid grid-cols-1 sm:grid-cols-[minmax(0,13rem)_1fr] sm:items-baseline p-3 bg-black/30 gap-x-6 gap-y-1"
          >
            <dt className="font-bold text-white/70 font-sans">{s.label}</dt>
            <dd className="font-mono text-white font-semibold">{s.value}</dd>
          </div>
        ))}
        {rows.map(([key, value]) => (
          <div
            key={key}
            className="grid grid-cols-1 sm:grid-cols-[minmax(0,13rem)_1fr] sm:items-baseline p-3 bg-black/30 gap-x-6 gap-y-1"
          >
            <dt className="font-bold text-white/70 font-sans">{t(`specs.${key}`)}</dt>
            <dd className={value ? 'font-mono text-white font-semibold' : 'font-mono text-white/30 italic'}>
              {value ? translateSpecValue(key, value, locale) : t('specs.specsNotPublished')}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-[11px] text-white/45 font-mono leading-relaxed">
        {t('specs.specsSourceLabel')}: {specs.specsSource}
      </p>
    </div>
  );
}
