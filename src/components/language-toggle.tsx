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
 * One disc, not two. The pair spent a second slot on the header's control rail
 * to say something the single disc already says, and with only two locales the
 * inactive flag was never a choice between options — it was the other state of
 * a switch.
 *
 * Still a real `<Link>`, never a button: it carries a genuine href to the other
 * locale, so middle-click, open-in-new-tab and copy-link all keep working, and
 * a crawler can still walk to the translation.
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

const Flag = ({ locale }: { locale: string }) =>
  locale === 'en' ? <FlagUSA /> : <FlagVietnam />;

export function LanguageToggle() {
  const pathname = usePathname();
  const params = useParams();
  const t = useTranslations('language');
  const active = (params.locale as string) ?? routing.defaultLocale;
  /* A toggle is only a toggle while there are exactly two locales. With a
     third, "the other one" stops being a single answer and this has to become
     a menu — `routing.locales` is read rather than the pair being hardcoded so
     that change is a compile-time visit here, not a silently wrong flag. */
  const other = routing.locales.find((l) => l !== active) ?? routing.defaultLocale;

  return (
    <Link
      href={pathname}
      locale={other}
      hrefLang={other}
      aria-label={t('switchTo', { language: t(other) })}
      title={t('switchTo', { language: t(other) })}
      className="group w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center cursor-pointer"
    >
      {/* The disc always shows the language you are **reading**, never the one
          you would get.

          It briefly did the opposite on hover, and that broke the only feedback
          this control has. The pointer sits on the button through the click, so
          the hover state survives the navigation: from `/vi` the disc showed VN
          at rest, US on hover, and then — now on `/en`, still hovered, still
          showing the *target* — VN again. Same flag before and after, on a
          header that otherwise looks identical. The language had switched; the
          button just made it look like nothing happened.

          Showing the current locale means the flag flips VN -> US on click and
          stays flipped. What the button *does* is carried by its accessible
          name and tooltip, which do not depend on where the pointer is.

          `group-hover`, not `hover`: the hit area is the 32/40px link, so a
          bare `hover:` on this inner disc would miss the ring of padding around
          it and the flag would flick as the pointer crossed the edge. */}
      <span className="relative block w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden ring-2 ring-white shadow-[0_0_16px_rgba(255,255,255,0.7)] transition-transform duration-300 ease-out group-hover:scale-110 group-active:scale-95">
        <Flag locale={active} />
      </span>
    </Link>
  );
}
