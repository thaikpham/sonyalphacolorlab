'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useAdminSession } from '@/components/admin-ui/session';
import type { ModeratedPhoto } from '@/lib/community/moderation';

/**
 * The open recipe's community photos, hidden ones included, newest first, each
 * with the switch that hides it from readers or shows it again.
 *
 * Keyed by slug from the editor, which is the column `community_photos` joins
 * on: the slug is fixed at creation, so the list cannot drift away from the
 * recipe it belongs to. Independent of the recipe draft — hiding a photo saves
 * at once and never touches unsaved fields.
 *
 * The thumbnail is a third party's URL drawn raw, as in the gallery, and asked
 * for with no referrer so the host does not learn the admin address. A link
 * that no longer loads stays listed: it is still a row, and still hideable.
 */
export function PhotoModeration({ slug }: { slug: string }) {
  const t = useTranslations('recipeAdmin');
  const format = useFormatter();
  const { authed } = useAdminSession();

  const [photos, setPhotos] = useState<ModeratedPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* One switch at a time: two answers landing out of order could otherwise
     leave a row showing the state it was in before the last click. */
  const [pending, setPending] = useState<string | null>(null);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());

  /* A photo-specific message first (`notFound` is a photo here, not a
     recipe), then the editor's shared ones, then the generic failure. */
  const message = useCallback(
    (code: string, fallback: 'loadFailed' | 'saveFailed') => {
      if (t.has(`photos.errors.${code}` as never)) return t(`photos.errors.${code}` as never);
      if (t.has(`errors.${code}` as never)) return t(`errors.${code}` as never);
      console.warn('[photoModeration] unknown error code:', code);
      return t(`errors.${fallback}`);
    },
    [t],
  );

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/community-photos?slug=${encodeURIComponent(slug)}`, {
          headers: authed(),
        });
        const data = (await res.json()) as { photos?: ModeratedPhoto[]; error?: string };
        if (!live) return;
        if (!res.ok || !data.photos) {
          setError(message(data.error ?? 'loadFailed', 'loadFailed'));
          return;
        }
        setPhotos(data.photos);
      } catch {
        if (live) setError(message('loadFailed', 'loadFailed'));
      }
    })();
    return () => {
      live = false;
    };
  }, [slug, authed, message]);

  const toggle = async (photo: ModeratedPhoto) => {
    setPending(photo.id);
    setError(null);
    try {
      const res = await fetch('/api/admin/community-photos', {
        method: 'PATCH',
        headers: authed(),
        body: JSON.stringify({ id: photo.id, approved: !photo.approved }),
      });
      const data = (await res.json()) as { photo?: ModeratedPhoto; error?: string };
      if (!res.ok || !data.photo) {
        setError(message(data.error ?? 'saveFailed', 'saveFailed'));
        return;
      }
      /* The row as the database now holds it, not the state that was asked
         for: the answer is what readers see. */
      const fresh = data.photo;
      setPhotos((cur) => cur?.map((p) => (p.id === fresh.id ? fresh : p)) ?? cur);
    } catch {
      setError(message('saveFailed', 'saveFailed'));
    } finally {
      setPending(null);
    }
  };

  const hiddenCount = photos?.filter((p) => !p.approved).length ?? 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-body-sm font-extrabold text-ink">{t('photos.title')}</h3>
        {photos && photos.length ? (
          <span className="meta tabular-nums">
            {t('photos.count', { n: photos.length })}
            {hiddenCount ? ` · ${t('photos.hiddenCount', { n: hiddenCount })}` : ''}
          </span>
        ) : null}
      </div>
      <p className="meta">{t('photos.hint')}</p>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      {photos === null ? (
        error ? null : <p className="meta">{t('photos.loading')}</p>
      ) : photos.length === 0 ? (
        <p className="text-body-sm text-ink-muted">{t('photos.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {photos.map((photo) => (
            <li key={photo.id} className="flex items-center gap-3 px-3 py-2 rounded-sm row-tint">
              <a
                href={photo.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 overflow-hidden rounded-sm"
              >
                {broken.has(photo.id) ? (
                  <span className="flex h-16 w-24 items-center justify-center px-2 bg-glass meta text-center">
                    {t('photos.imageFailed')}
                  </span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element -- reader-supplied URL, arbitrary host */
                  <img
                    src={photo.imageUrl}
                    alt={t('photos.alt')}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setBroken((prev) => new Set(prev).add(photo.id))}
                    className={`h-16 w-24 object-cover ${photo.approved ? '' : 'opacity-50'}`}
                  />
                )}
              </a>
              <span className="flex min-w-0 grow flex-col">
                <span className={`label ${photo.approved ? 'text-ink-faint' : 'text-danger'}`}>
                  {photo.approved ? t('photos.visible') : t('photos.hidden')}
                </span>
                <span className="text-body-sm font-semibold text-ink truncate">
                  {photo.authorName ?? t('notSet')}
                </span>
                {/* Rendered only after the list loads, client-side, so the
                    browser's own zone is safe and avoids the provider fallback. */}
                <span className="meta tabular-nums">
                  {format.dateTime(new Date(photo.createdAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  })}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void toggle(photo)}
                disabled={pending !== null}
                aria-busy={pending === photo.id || undefined}
                className="btn-glass shrink-0 cursor-pointer disabled:opacity-50"
              >
                {pending === photo.id ? t('saving') : photo.approved ? t('photos.hide') : t('photos.show')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
