'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/**
 * Switches locale while staying on the same recipe.
 *
 * `usePathname` from the i18n navigation helpers returns the path without the
 * locale prefix, so re-linking it under another locale keeps the reader where
 * they are — switching language on a recipe page must not bounce them home.
 *
 * A segmented control, not a flag disc. The flags were two hand-drawn SVGs of
 * raw hex — a red/yellow/blue field in an interface whose whole colour rule is
 * "no red, no yellow, no green, no hex in a component" — sitting behind a white
 * 2px stroke and a white halation, neither of which the system has. What is
 * left is what the control actually is: a rut pressed into the surface
 * (`.surface-sunken`) with the current locale carrying an accent-tinted fill.
 * A selected state is a fill, never a stroke.
 *
 * Still real `<Link>`s, never buttons: each carries a genuine href to the other
 * locale, so middle-click, open-in-new-tab and copy-link all keep working, and a
 * crawler can still walk to the translation. The current locale is a `<span>`,
 * not a link to itself.
 *
 * The segments are mapped from `routing.locales` rather than a hardcoded pair,
 * so a third locale grows a third segment instead of silently rendering the
 * wrong "other one".
 */

/* 4% film + accent tint under the current segment. A selected state in this
   system is an accent-tinted FILL with a level-1 shadow under it — the moment it
   becomes a 1px outline the control reads as boxed in. */
const ACTIVE_FILL =
  'bg-[linear-gradient(180deg,color-mix(in_oklch,var(--color-accent-500)_20%,transparent),color-mix(in_oklch,var(--color-accent-500)_7%,transparent))] shadow-[var(--elevation-1)]';

const SEGMENT =
  'flex min-h-[var(--layout-touch-target)] items-center justify-center px-3 ' +
  'text-label font-semibold tracking-[0.08em]';

export function LanguageToggle() {
  const pathname = usePathname();
  const params = useParams();
  const t = useTranslations('language');
  const active = (params.locale as string) ?? routing.defaultLocale;

  return (
    <div className="surface-sunken flex shrink-0 items-stretch overflow-hidden">
      {routing.locales.map((locale) =>
        locale === active ? (
          /* The segment always shows the language you are **reading**, and the
             fill is the only thing that moves on click. It briefly did the
             opposite on hover as a single disc, and that broke the only feedback
             this control has: the pointer stays on it through the click, so the
             hover state survived the navigation and the mark looked identical
             before and after. What the control *does* is carried by the other
             segment's accessible name, which does not depend on the pointer. */
          <span
            key={locale}
            aria-current="true"
            className={`${SEGMENT} rounded-md text-ink ${ACTIVE_FILL}`}
          >
            <span aria-hidden>{locale.toUpperCase()}</span>
            <span className="sr-only">{t(locale)}</span>
          </span>
        ) : (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            hrefLang={locale}
            aria-label={t('switchTo', { language: t(locale) })}
            title={t('switchTo', { language: t(locale) })}
            className={`${SEGMENT} cursor-pointer text-ink-faint transition-colors hover:text-ink`}
          >
            <span aria-hidden>{locale.toUpperCase()}</span>
          </Link>
        ),
      )}
    </div>
  );
}
