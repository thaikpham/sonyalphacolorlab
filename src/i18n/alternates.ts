import { routing } from './routing';

/**
 * `alternates` for a page whose content exists in both locales (ADR 0004):
 * each locale canonical for itself, the pair declared as alternates.
 *
 * The canonical is always the bare path. A filtered view — `/colorlab?tag=…`,
 * `/blog?topic=af`, `/cameras?cat=lens` — is the same page narrowed, and
 * without a canonical every filter combination was a separate indexable URL.
 *
 * Not for a page whose body is authored Vietnamese on both locales (an
 * article, a knowledge page): those name the Vietnamese URL canonical and
 * declare no alternates, in their own `generateMetadata`.
 */
export function bilingualAlternates(locale: string, rest: string) {
  const at = (l: string) => (l === routing.defaultLocale ? rest : `/${l}${rest === '/' ? '' : rest}`);
  return {
    canonical: at(locale),
    languages: Object.fromEntries(routing.locales.map((l) => [l, at(l)])),
  };
}
