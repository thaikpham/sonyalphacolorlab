'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { OPEN_TWEAK_EVENT } from '@/lib/community/events';
import { isTweakErrorCode } from '@/lib/ai/errors';
import { formatWhiteBalance } from '@/lib/camera/format';
import type { WhiteBalance } from '@/lib/camera/schema';

/**
 * "Tweak with AI".
 *
 * Clean dark glass card, warm spark accent, Noto Sans throughout, inline action
 * bar. The request goes to `claude-sonnet-5` — see `src/lib/ai/tweak.ts`.
 */

type Result = { whiteBalance: WhiteBalance; settings: Record<string, unknown>; summary: string };

type Props = {
  slug: string;
  locale: 'en' | 'vi';
  currentWb: WhiteBalance;
  currentSettings: Record<string, unknown>;
};

/** Flattens nested settings to `a.b` keys so the diff is one flat list. */
function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object') return { [prefix]: String(value) };
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [k, v]) => Object.assign(acc, flatten(v, prefix ? `${prefix}.${k}` : k)),
    {},
  );
}

export function TweakPanel({ slug, locale, currentWb, currentSettings }: Props) {
  const t = useTranslations('tweak');
  const [isOpen, setIsOpen] = useState(false);
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  /* Opened by the gallery's AI tile, which is in a sibling component — see
     `OPEN_TWEAK_EVENT`. The scroll and focus wait a frame because neither the
     panel nor the textarea exists until this render commits, and `focus()`
     scrolls the element into view itself, which would cancel the smooth scroll
     already in flight and land the reader at the textarea with the heading
     above the fold. */
  useEffect(() => {
    const open = () => {
      setIsOpen(true);
      requestAnimationFrame(() => {
        document.getElementById('tweak-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('tweak-request')?.focus({ preventScroll: true });
      });
    };
    window.addEventListener(OPEN_TWEAK_EVENT, open);
    return () => window.removeEventListener(OPEN_TWEAK_EVENT, open);
  }, []);

  /* Read from the catalogue, not from a `locale === 'vi'` ternary: the copy for
     one language sat inside a component in the other's file, where nothing that
     checks translations could see it. */
  const samplePrompts = [
    { icon: '✨', text: t('sampleWarm') },
    { icon: '🎬', text: t('sampleShadow') },
    { icon: '🌸', text: t('sampleSkin') },
    { icon: '🌅', text: t('sampleGolden') },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!request.trim() || busy) return;

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/tweak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, request: request.trim(), locale }),
      });
      const data = await res.json();
      /* The body carries a code, never a sentence. Rendering `data.error`
         directly is what put English on screen for Vietnamese readers, and once
         put a Zod validation message there naming internal fields. */
      if (!res.ok) setError(t(`errors.${isTweakErrorCode(data?.error) ? data.error : 'unknown'}`));
      else setResult(data as Result);
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  const before: Record<string, string> = {
    ...flatten(currentSettings),
    whiteBalance: formatWhiteBalance(currentWb),
  };
  const after: Record<string, string> | null = result
    ? { ...flatten(result.settings), whiteBalance: formatWhiteBalance(result.whiteBalance) }
    : null;

  const rows = after
    ? [...new Set([...Object.keys(before), ...Object.keys(after)])].map((key) => ({
        key,
        from: before[key] ?? '—',
        to: after[key] ?? '—',
        changed: before[key] !== after[key],
      }))
    : [];
  const changedCount = rows.filter((r) => r.changed).length;

  /*
   * The opaque fill, border and shadow live on the outer wrapper, not on the
   * glass panel. `.glass` is unlayered CSS written after `@import
   * "tailwindcss"`, so it hard-sets `background` and `box-shadow` and declares
   * `border: 0 !important` — every one of `bg-black/40`, `border-white/10`,
   * `shadow-xl` and `rounded-2xl` was dead on that element and the panel
   * floated fully translucent over the recipe photograph. Painting the colour
   * underneath lets the glass gradient sit on top of it and still read as glass.
   */
  /* Nothing at all until the reader asks for it. Returning null rather than
     hiding with a class keeps the AI form — and the request state inside it —
     off every recipe page that nobody tweaks. */
  if (!isOpen) return null;

  return (
    <section
      id="tweak-panel"
      className="mt-8 overflow-hidden rounded-[var(--radius-glass)] border border-white/10 bg-black/40 shadow-xl font-sans animate-fade-in"
    >
      <div className="glass p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-ai text-sm">✨</span>
            <div>
              <h2 className="text-xs font-bold tracking-wider uppercase text-white/90 font-sans">
                {t('title')}
              </h2>
              <p className="text-xs text-white/50 font-sans mt-0.5">
                {t('subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            title={t('close')}
            aria-label={t('close')}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span aria-hidden className="text-sm">✕</span>
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3 font-sans">
          <label htmlFor="tweak-request" className="sr-only">
            {t('placeholder')}
          </label>
        
          <textarea
            id="tweak-request"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={t('placeholder')}
            rows={2}
            maxLength={500}
            className="w-full resize-y rounded-xl bg-black/60 p-3.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 font-sans shadow-inner transition-all border border-white/10"
          />

          {/* Bottom Row: Quick Prompts (Left) + Submit Button (Far Right) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Quick Prompts */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs text-white/45 font-sans mr-0.5">
                {t('quickIdeas')}
              </span>
              {samplePrompts.map(({ icon, text }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => setRequest(text)}
                  className="text-xs font-sans px-3 py-1 rounded-full glass-flat text-white/70 hover:text-white hover:border-white/30 transition-all cursor-pointer"
                >
                  {icon} {text}
                </button>
              ))}
            </div>

            {/* Submit Button (Far Right) */}
            <button
              type="submit"
              disabled={busy || !request.trim()}
              className="font-sans px-5 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:scale-100 shrink-0 ml-auto"
            >
              {busy ? t('working') : t('submit')}
            </button>
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-4 text-xs text-danger font-sans font-medium">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-5 pt-4 border-t border-white/10 font-sans">
            <p className="text-sm leading-relaxed text-white/80 font-sans">{result.summary}</p>

            <p className="text-xs font-bold tracking-wide uppercase mt-4 mb-2 text-white/90 font-sans">
              {t('changeCount', { count: changedCount })}
            </p>
            <dl className="text-sm font-sans grid grid-cols-1 gap-1">
              {rows.map((r) => (
                <div
                  key={r.key}
                  className={`flex items-baseline justify-between gap-4 border-b border-white/5 py-1.5 px-2 rounded transition-colors ${
                    r.changed ? 'bg-white/5' : 'opacity-35'
                  }`}
                >
                  <dt className="text-white/70 text-xs font-sans">{r.key}</dt>
                  <dd className="tabular flex items-baseline gap-2 text-xs font-sans">
                    {r.changed && <span className="text-white/40 line-through font-sans">{r.from}</span>}
                    <span className="font-bold font-sans" style={r.changed ? { color: 'var(--accent)' } : undefined}>{r.to}</span>
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-3 text-xs leading-relaxed text-white/40 font-sans">{t('disclaimer')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
