'use client';

import { Link, usePathname } from '@/i18n/navigation';

/**
 * The apps a missing page can belong to, each with its own index.
 *
 * `[locale]/not-found.tsx` is the one boundary for every `notFound()` under the
 * locale — a recipe, a camera, a headphone, an article, a reference page. Its
 * copy was the recipe's ("That recipe isn't here", "Browse all recipes") and
 * its way out was `/colorlab`, so a dead `/blog/<id>` link apologised for a
 * recipe under the blog's header and sent the reader to the recipe grid.
 */
export const NOT_FOUND_APPS = ['recipe', 'camera', 'audio', 'blog', 'learn'] as const;
export type NotFoundApp = (typeof NOT_FOUND_APPS)[number];

const INDEX: Record<NotFoundApp, string> = {
  recipe: '/colorlab',
  camera: '/cameras',
  audio: '/audio',
  blog: '/blog',
  learn: '/learn',
};

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Which app `pathname` (locale already stripped) belongs to. ColorLab by default. */
export function notFoundApp(pathname: string): NotFoundApp {
  if (under(pathname, '/cameras')) return 'camera';
  if (under(pathname, '/audio')) return 'audio';
  if (under(pathname, '/blog')) return 'blog';
  if (under(pathname, '/learn')) return 'learn';
  return 'recipe';
}

export type NotFoundCopy = Record<NotFoundApp, { title: string; body: string; action: string }>;

/**
 * The 404's text, picked by the path the reader asked for.
 *
 * A client component only because a not-found boundary receives no params and
 * the path is known only here. The copy for every app arrives as props,
 * translated on the server, so the `notFound` namespace is not shipped to
 * every page's client for the sake of this one.
 */
export function NotFoundBody({ copy }: { copy: NotFoundCopy }) {
  const app = notFoundApp(usePathname());
  const { title, body, action } = copy[app];
  return (
    <>
      <h1 className="mt-6 text-title-1 font-extrabold tracking-[-0.02em]">{title}</h1>
      <p className="mt-3 max-w-md text-body text-ink-muted">{body}</p>
      {/* The app's own index, never `/` — that is the ecosystem launcher and
          would answer a missing page with four app tiles. */}
      <Link href={INDEX[app]} className="btn-glass mt-8 inline-flex items-center">
        {action}
      </Link>
    </>
  );
}
