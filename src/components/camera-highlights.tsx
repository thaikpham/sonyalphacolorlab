import { getTranslations } from 'next-intl/server';
import { CORE_SPEC_KEYS, type HighlightsSide } from '@/lib/cameras/highlights';

/**
 * What a buyer reads first on a camera page: the features that matter,
 * explained, and the handful of specs that decide a purchase. Rendered only
 * for a camera with valid `highlights`; the page falls back to the feature
 * bullets otherwise. Server Components — nothing here reaches the browser.
 */

export async function CameraHighlights({ points }: { points: HighlightsSide['points'] }) {
  const t = await getTranslations('cameras');
  return (
    <section aria-labelledby="h-highlights" className="surface flex flex-col gap-3 p-5">
      <h2 id="h-highlights" className="text-title-3 font-semibold tracking-[-0.02em] text-ink">
        {t('featuresLabel')}
      </h2>
      <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {points.map((p, i) => (
          <li key={`${i}-${p.title}`} className="row-tint flex flex-col gap-1 rounded-sm p-4">
            <h3 className="text-body font-semibold text-ink">{p.title}</h3>
            <p className="text-body-sm leading-relaxed text-ink-muted">{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function CoreSpecs({ rows }: { rows: HighlightsSide['keySpecs'] }) {
  const t = await getTranslations('cameras');
  const ordered = [...rows].sort((a, b) => CORE_SPEC_KEYS.indexOf(a.key) - CORE_SPEC_KEYS.indexOf(b.key));
  return (
    <section aria-labelledby="h-core-specs" className="surface flex flex-col gap-3 p-5">
      <h2 id="h-core-specs" className="text-title-3 font-semibold tracking-[-0.02em] text-ink">
        {t('coreSpecsTitle')}
      </h2>
      <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {ordered.map((r) => (
          <div key={r.key} className="row-tint flex flex-col gap-0.5 rounded-sm px-4 py-3">
            <dt className="meta">{t(`coreSpecs.${r.key}`)}</dt>
            <dd className="text-body-sm font-semibold text-ink tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
