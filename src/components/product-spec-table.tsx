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
     the two it is. On screen that placeholder is an em dash — a blank cell
     reads as a rendering bug — with the sentence kept for screen readers. */
  const rows = SPEC_ROWS[specs.kind].map((key) => [key, row[key] ?? null] as const);
  const extra = specs.kind === 'accessory' ? specs.keySpecs : [];

  /* Rows separate by a 4% film on every other row, not by a line: on a dark
     ground a hairline grid reads as noise. The two lists are one visual run, so
     the accessory rows carry the offset into the spec rows' parity. */
  const tint = (i: number) => (i % 2 === 1 ? 'row-tint' : '');
  const cell = 'grid grid-cols-1 sm:grid-cols-[minmax(0,13rem)_1fr] sm:items-baseline px-4 py-3 gap-x-6 gap-y-1';

  return (
    <div className="surface p-5 flex flex-col gap-3">
      <h3 className="label">{t('specs.specsHeading')}</h3>

      {/* A fixed label track, with the value starting where the label ends.
          `justify-between` pinned the value to the far right edge, so on a wide
          screen a two-word label and a two-word value sat ~1100px apart with
          nothing between them and the eye had to travel the gap on every row. */}
      <dl className="flex flex-col gap-1 text-body-sm">
        {extra.map((s, i) => (
          <div key={s.label} className={`${cell} ${tint(i)}`}>
            <dt className="font-semibold text-ink-muted">{s.label}</dt>
            <dd className="font-medium text-ink tabular-nums">{s.value}</dd>
          </div>
        ))}
        {rows.map(([key, value], i) => (
          <div key={key} className={`${cell} ${tint(extra.length + i)}`}>
            <dt className="font-semibold text-ink-muted">{t(`specs.${key}`)}</dt>
            <dd className={value ? 'font-medium text-ink tabular-nums' : 'text-ink-faint'}>
              {value ? (
                translateSpecValue(key, value, locale)
              ) : (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">{t('specs.specsNotPublished')}</span>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p className="meta leading-relaxed">
        {t('specs.specsSourceLabel')}: {specs.specsSource}
      </p>
    </div>
  );
}
