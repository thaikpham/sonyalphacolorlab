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
 * Real links with interactive hover animation.
 */
function FlagUSA() {
  return (
    <svg className="w-full h-full rounded-full overflow-hidden shrink-0 shadow-inner" viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" fill="#B22234" />
      <rect y="7.69" width="100" height="7.69" fill="#FFFFFF" />
      <rect y="23.07" width="100" height="7.69" fill="#FFFFFF" />
      <rect y="38.46" width="100" height="7.69" fill="#FFFFFF" />
      <rect y="53.84" width="100" height="7.69" fill="#FFFFFF" />
      <rect y="69.23" width="100" height="7.69" fill="#FFFFFF" />
      <rect y="84.61" width="100" height="7.69" fill="#FFFFFF" />
      <rect width="45" height="53.84" fill="#3C3B6E" />
      <circle cx="9" cy="9" r="2.5" fill="#FFFFFF" />
      <circle cx="22.5" cy="9" r="2.5" fill="#FFFFFF" />
      <circle cx="36" cy="9" r="2.5" fill="#FFFFFF" />
      <circle cx="15.75" cy="18" r="2.5" fill="#FFFFFF" />
      <circle cx="29.25" cy="18" r="2.5" fill="#FFFFFF" />
      <circle cx="9" cy="27" r="2.5" fill="#FFFFFF" />
      <circle cx="22.5" cy="27" r="2.5" fill="#FFFFFF" />
      <circle cx="36" cy="27" r="2.5" fill="#FFFFFF" />
      <circle cx="15.75" cy="36" r="2.5" fill="#FFFFFF" />
      <circle cx="29.25" cy="36" r="2.5" fill="#FFFFFF" />
      <circle cx="9" cy="45" r="2.5" fill="#FFFFFF" />
      <circle cx="22.5" cy="45" r="2.5" fill="#FFFFFF" />
      <circle cx="36" cy="45" r="2.5" fill="#FFFFFF" />
    </svg>
  );
}

function FlagVietnam() {
  return (
    <svg className="w-full h-full rounded-full overflow-hidden shrink-0 shadow-inner" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#DA251D" />
      <polygon
        fill="#FFFF00"
        points="50,22 56.6,40.9 76.6,41.3 60.6,53.5 66.5,72.7 50,61.2 33.5,72.7 39.4,53.5 23.4,41.3 43.4,40.9"
      />
    </svg>
  );
}

export function LanguageToggle() {
  const pathname = usePathname();
  const params = useParams();
  const t = useTranslations('language');
  const active = (params.locale as string) ?? routing.defaultLocale;

  return (
    <nav aria-label={t('label')} className="flex items-center gap-2">
      {routing.locales.map((locale) => {
        const on = locale === active;
        const isEn = locale === 'en';
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            hrefLang={locale}
            aria-current={on ? 'true' : undefined}
            aria-label={t(locale)}
            title={t(locale)}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:scale-110 active:scale-95 cursor-pointer overflow-hidden ${
              on
                ? 'ring-2 ring-white shadow-[0_0_16px_rgba(255,255,255,0.7)] scale-105 opacity-100'
                : 'opacity-40 hover:opacity-100 hover:ring-1 hover:ring-white/50'
            }`}
          >
            {isEn ? <FlagUSA /> : <FlagVietnam />}
          </Link>
        );
      })}
    </nav>
  );
}
