'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminSession } from '@/components/admin-ui/session';
import { FIELD_SM } from '@/components/admin-ui/controls';
import { MAX_UPLOAD_BYTES } from '@/lib/recipes/upload-limits';

/**
 * A recipe's photographs.
 *
 * The one thing this screen has to communicate, and the reason it says it on
 * every row rather than once at the top: an uploaded photograph is the
 * editor's immediately and the site's at the next deploy. Storage here is the
 * intake, not the origin — readers are served from `public/recipes`, which is
 * what ended the 1.27 GB/day of cached egress that restricted the whole project
 * on 2026-09-11. `npm run vendor:uploads` is what moves a photograph across.
 *
 * So `live` is per row, from the deployed manifest, and a pending photograph is
 * labelled wherever it appears. An editor who uploads five and sees no badge
 * has learned the wrong thing about their site.
 *
 * Previews are plain `<img>`, never `next/image`, and for two separate reasons
 * that happen to point the same way. A pending preview is a SIGNED Storage URL
 * that expires — `next.config.ts` allows only `/object/public/**` through the
 * image pipeline and says in as many words that a signed path must never be
 * reachable that way. A live one is already a bounded WebP variant on the
 * static CDN, so the loader's rung rewriting would either do nothing or ask for
 * a width that was never generated. The article editor's draft slots are a
 * plain `<img>` for the first of those reasons.
 */

type AdminImage = {
  id: string;
  storagePath: string;
  alt: string | null;
  sort: number;
  width: number | null;
  height: number | null;
  live: boolean;
  previewUrl: string;
};

export function ImagePanel({ recipeId }: { recipeId: string }) {
  const t = useTranslations('recipeAdmin');
  const { authed, bearer } = useAdminSession();
  const [images, setImages] = useState<AdminImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const codeMessage = useCallback(
    (code: string) => (t.has(`errors.${code}` as never) ? t(`errors.${code}` as never) : code),
    [t],
  );

  const fetchImages = useCallback(async (): Promise<AdminImage[] | null> => {
    try {
      const res = await fetch(`/api/admin/recipes/${recipeId}/images`, { headers: authed() });
      const data = (await res.json()) as { images?: AdminImage[]; error?: string };
      if (!res.ok || !data.images) {
        setNote({ kind: 'err', msg: codeMessage(data.error ?? 'loadFailed') });
        return null;
      }
      return data.images;
    } catch {
      setNote({ kind: 'err', msg: codeMessage('loadFailed') });
      return null;
    }
  }, [recipeId, authed, codeMessage]);

  useEffect(() => {
    let live = true;
    (async () => {
      const rows = await fetchImages();
      if (live && rows) setImages(rows);
    })();
    return () => {
      live = false;
    };
  }, [fetchImages]);

  const reload = async () => {
    const rows = await fetchImages();
    if (rows) setImages(rows);
  };

  const upload = async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      setNote({ kind: 'err', msg: codeMessage('tooLarge') });
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/admin/recipes/${recipeId}/images`, {
        method: 'POST',
        /* No `Content-Type`: the browser sets it so the multipart boundary
           matches the body it generated. */
        headers: bearer(),
        body: form,
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; pendingVendor?: boolean };
      if (!res.ok) {
        setNote({ kind: 'err', msg: codeMessage(data.error ?? 'uploadFailed') });
        return;
      }
      await reload();
      setNote({ kind: 'ok', msg: data.pendingVendor ? t('uploadedPending') : t('uploadedLive') });
    } catch {
      setNote({ kind: 'err', msg: codeMessage('uploadFailed') });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const move = async (index: number, delta: number) => {
    const next = [...images];
    const to = index + delta;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    setImages(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/recipes/${recipeId}/images`, {
        method: 'PATCH',
        headers: authed(),
        body: JSON.stringify({ order: next.map((i) => i.id) }),
      });
      const data = (await res.json()) as { images?: AdminImage[]; error?: string };
      if (!res.ok) {
        setNote({ kind: 'err', msg: codeMessage(data.error ?? 'saveFailed') });
        await reload();
        return;
      }
      if (data.images) setImages(data.images);
      setNote({ kind: 'ok', msg: t('orderPending') });
    } catch {
      setNote({ kind: 'err', msg: codeMessage('saveFailed') });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const saveAlt = async (id: string, alt: string) => {
    try {
      const res = await fetch(`/api/admin/recipes/${recipeId}/images/${id}`, {
        method: 'PATCH',
        headers: authed(),
        body: JSON.stringify({ alt }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setNote({ kind: 'err', msg: codeMessage(data.error ?? 'saveFailed') });
      }
    } catch {
      setNote({ kind: 'err', msg: codeMessage('saveFailed') });
    }
  };

  const remove = async (image: AdminImage) => {
    const message = image.live ? t('removeLiveConfirm') : t('removePendingConfirm');
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/recipes/${recipeId}/images/${image.id}`, {
        method: 'DELETE',
        headers: authed(),
      });
      const data = (await res.json()) as { error?: string; pendingVendor?: boolean };
      if (!res.ok) {
        setNote({ kind: 'err', msg: codeMessage(data.error ?? 'saveFailed') });
        return;
      }
      await reload();
      setNote({
        kind: 'ok',
        msg: image.live && data.pendingVendor ? t('removedPending') : t('removedLive'),
      });
    } catch {
      setNote({ kind: 'err', msg: codeMessage('saveFailed') });
    } finally {
      setBusy(false);
    }
  };

  const pending = images.filter((i) => !i.live).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-body-sm font-extrabold tracking-[-0.01em] text-ink">{t('photos')}</h3>
        <span className="meta">{t('photosHint')}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
          className="text-body-sm text-ink-muted"
        />
        {busy ? <span className="meta">{t('working')}</span> : null}
      </div>

      {pending > 0 ? (
        /* The banner is the call to action the pipeline needs and nothing else
           on the screen can supply: the photographs exist, and one command
           stands between them and the site. */
        <p className="surface-sunken rounded-sm p-3 text-body-sm text-ink">
          {t('pendingBanner', { n: pending })}
          <code className="ml-2 text-accent-400">npm run vendor:uploads -- --target content</code>
        </p>
      ) : null}

      {note ? (
        <p className={`text-body-sm ${note.kind === 'err' ? 'text-danger' : 'text-ink-muted'}`}>
          {note.msg}
        </p>
      ) : null}

      {images.length === 0 ? (
        <p className="meta">{t('noPhotos')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {images.map((img, i) => (
            <li key={img.id} className="surface-raised flex flex-wrap gap-4 rounded-md p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt={img.alt ?? ''}
                className="h-24 w-32 shrink-0 rounded-sm bg-black/40 object-cover"
              />

              <div className="flex min-w-[14rem] grow flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="label text-ink-faint tabular-nums">#{i + 1}</span>
                  <span className={`label ${img.live ? 'text-ink-muted' : 'text-accent-400'}`}>
                    {img.live ? t('photoLive') : t('photoPending')}
                  </span>
                  {img.width && img.height ? (
                    <span className="meta tabular-nums">
                      {img.width}×{img.height}
                    </span>
                  ) : null}
                </div>

                <input
                  className={FIELD_SM}
                  defaultValue={img.alt ?? ''}
                  placeholder={t('altPlaceholder')}
                  /* Saved on blur rather than per keystroke: alt text is a
                     sentence, and one request per character is a request per
                     character. */
                  onBlur={(e) => void saveAlt(img.id, e.target.value)}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || i === 0}
                    onClick={() => void move(i, -1)}
                    className="btn-glass px-3 cursor-pointer disabled:opacity-40"
                  >
                    {t('moveUp')}
                  </button>
                  <button
                    type="button"
                    disabled={busy || i === images.length - 1}
                    onClick={() => void move(i, 1)}
                    className="btn-glass px-3 cursor-pointer disabled:opacity-40"
                  >
                    {t('moveDown')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(img)}
                    className="btn-glass px-3 cursor-pointer text-danger disabled:opacity-40"
                  >
                    {t('removePhoto')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
