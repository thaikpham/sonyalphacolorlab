import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/** The department's front door. One card per app. */

export default async function AdminHome() {
  const t = await getTranslations({ locale: 'vi', namespace: 'adminUi' });

  const cards = [
    { href: '/admin/colorlab', title: t('sectionColorlab'), body: t('sectionColorlabBody') },
    { href: '/admin/wiki', title: t('sectionWiki'), body: t('sectionWikiBody') },
    { href: '/admin/blog', title: t('sectionBlog'), body: t('sectionBlogBody') },
  ];

  return (
    <main className="mx-auto w-full max-w-[72rem] inset-safe py-12 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-title-1 font-extrabold tracking-[-0.02em] text-ink">{t('homeTitle')}</h1>
        <p className="text-body leading-relaxed text-ink-muted">{t('homeBody')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="surface-raised flex flex-col gap-2 p-6 rounded-md hover:text-ink"
          >
            <span className="text-body-lg font-extrabold tracking-[-0.02em] text-ink">
              {c.title}
            </span>
            <span className="text-body-sm leading-relaxed text-ink-muted">{c.body}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
