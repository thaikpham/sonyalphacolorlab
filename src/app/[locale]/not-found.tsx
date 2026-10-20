import { getTranslations } from 'next-intl/server';
import { SiteHeader } from '@/components/site-header';
import { NotFoundBody, type NotFoundCopy } from '@/components/not-found-body';
import { NOT_FOUND_APPS } from '@/components/not-found-apps';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  /* Every app's copy, because this one boundary answers every `notFound()`
     under the locale and only the client knows which path was asked for. It
     said "That recipe isn't here" and linked to /colorlab for a missing
     camera, article or reference page too. */
  const copy = Object.fromEntries(
    NOT_FOUND_APPS.map((app) => [
      app,
      { title: t(`${app}.title`), body: t(`${app}.body`), action: t(`${app}.action`) },
    ]),
  ) as NotFoundCopy;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[86rem] flex-1 flex-col items-start justify-center inset-safe py-32">
        {/* A quiet mark rather than a big "404". It was box-drawing characters
            in a mono face; the glyphs only line up at a fixed pitch, so the
            drawing left with the second family. The same badge as the error
            page, in ink rather than a signal — a missing page classifies
            nothing. */}
        <div
          aria-hidden
          className="surface flex size-16 items-center justify-center text-title-2 font-extrabold text-ink-faint"
        >
          ?
        </div>
        <NotFoundBody copy={copy} />
      </main>
    </>
  );
}
