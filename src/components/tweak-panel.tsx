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
 * A panel that appears in place: `.surface` + `.animate-fade-in`, an inline
 * action bar, and the `ai` orchid signal on the values the model actually
 * changed — the one thing in the panel that classifies content rather than
 * decorating it. The request goes to `claude-sonnet-5` — see
 * `src/lib/ai/tweak.ts`.
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

  /* Nothing at all until the reader asks for it. Returning null rather than
     hiding with a class keeps the AI form — and the request state inside it —
     off every recipe page that nobody tweaks. */
  if (!isOpen) return null;

  /* `.surface` is unlayered CSS written after `@import "tailwindcss"`, so it
     wins over every `bg-*`, `rounded-*` and `shadow-*` utility on its own
     element. That is deliberate: an elevation is one whole recipe, so the panel
     takes the level and nothing patches a single part of it. Padding lives on
     the wrapper inside. */
  return (
    <section id="tweak-panel" className="surface animate-fade-in mt-8 overflow-hidden">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-body-lg text-ai">
              ✨
            </span>
            <div>
              <h2 className="text-title-3 font-semibold tracking-[-0.02em] text-ink">
                {t('title')}
              </h2>
              <p className="meta mt-1">{t('subtitle')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            title={t('close')}
            aria-label={t('close')}
            className="flex min-h-[var(--layout-touch-target)] min-w-[var(--layout-touch-target)] shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
          >
            <span aria-hidden className="text-body-lg">
              ✕
            </span>
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label htmlFor="tweak-request" className="sr-only">
            {t('placeholder')}
          </label>

          {/* An input is the one inverted elevation in the system: pressed into
              the surface rather than raised out of it. The `:focus-visible`
              outline is global and is the only stroke left in the app — it is
              never re-declared or overridden here. */}
          <textarea
            id="tweak-request"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={t('placeholder')}
            rows={2}
            maxLength={500}
            className="surface-sunken w-full resize-y p-4 text-body text-ink placeholder:text-ink-faint"
          />

          {/* Bottom Row: Quick Prompts (Left) + Submit Button (Far Right) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Prompts */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="meta mr-1">{t('quickIdeas')}</span>
              {samplePrompts.map(({ icon, text }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => setRequest(text)}
                  className="inline-flex min-h-[var(--layout-touch-target)] cursor-pointer items-center rounded-sm bg-white/8 px-3 text-body-sm text-ink-muted transition-colors hover:bg-white/13 hover:text-ink"
                >
                  {icon} {text}
                </button>
              ))}
            </div>

            {/* Submit Button (Far Right) */}
            <button
              type="submit"
              disabled={busy || !request.trim()}
              className="btn-accent ml-auto shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-35"
            >
              {busy ? t('working') : t('submit')}
            </button>
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-4 text-body-sm font-medium text-danger">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-6">
            {/* Light, not a line: the divider fades out at both ends. */}
            <hr className="seam mb-4" />

            <p className="text-body leading-relaxed text-ink-muted">{result.summary}</p>

            {/* Not `.label`: uppercase is capped at three words and the
                Vietnamese plural runs to six. It recedes by weight and ink step
                instead — never by size, never by contrast. */}
            <p className="mt-4 mb-2 text-label font-semibold text-ink-faint">
              {t('changeCount', { count: changedCount })}
            </p>
            <dl className="grid grid-cols-1 gap-1">
              {rows.map((r) => (
                <div
                  key={r.key}
                  className={`flex items-baseline justify-between gap-4 px-3 py-2 ${
                    r.changed ? 'row-tint' : ''
                  }`}
                >
                  <dt className="text-body-sm text-ink-muted">{r.key}</dt>
                  {/* A compare column, so the figures get `tabular-nums`
                      explicitly. Noto Sans has true tabular figures — there is
                      no second face to reach for. */}
                  <dd className="flex items-baseline gap-2 text-body-sm tabular-nums">
                    {r.changed && <span className="text-ink-faint line-through">{r.from}</span>}
                    <span className={r.changed ? 'font-semibold text-ai' : 'text-ink-faint'}>
                      {r.to}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>

            <p className="meta mt-4 leading-relaxed">{t('disclaimer')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
