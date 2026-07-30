import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The AI endpoint costs money per call and has nothing to index.
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
