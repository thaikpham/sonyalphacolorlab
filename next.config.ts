import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/**
 * Legacy redirects.
 *
 * sonycolorlab.app was a single-page app that addressed recipes with a **query
 * parameter**, not a path — `recipe-service.js` did
 * `newUrl.searchParams.set('id', ...)`, and the share button built
 * `origin + ?id=<recipeId>`. So every link already shared in Facebook groups
 * looks like `https://sonycolorlab.app/?id=scl-001`, never `/recipe/scl-001`.
 *
 * A path-based redirect map would therefore have caught nothing.
 *
 * These only fire for traffic that reaches this app, so at cutover the old
 * hostname must resolve here (or carry an equivalent rule at the CDN).
 */
function legacyRedirects() {
  const recipes = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as {
    slug: string;
    legacyId: string | null;
  }[];

  return recipes
    .filter((r): r is { slug: string; legacyId: string } => Boolean(r.legacyId))
    .map((r) => ({
      source: '/',
      has: [{ type: 'query' as const, key: 'id', value: r.legacyId }],
      destination: `/recipe/${r.slug}`,
      permanent: true,
    }));
}

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    // Only the project's own Storage host. Left empty when Supabase is not
    // configured, so a misconfigured deploy cannot silently proxy arbitrary URLs.
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
      : [],
  },
  async redirects() {
    return legacyRedirects();
  },
};

export default withNextIntl(nextConfig);
