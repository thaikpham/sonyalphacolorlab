import type { MetadataRoute } from 'next';

/**
 * Installable web app.
 *
 * `display: standalone` is what buys back screen space: once installed the app
 * runs without browser chrome, which on a phone is roughly 120px of address bar
 * and toolbar — about one more row of the recipe grid.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Alpha ColorLab',
    short_name: 'ColorLab',
    description:
      'White Balance Shift recipes for Sony Alpha cameras, paired with Picture Profile or Creative Look.',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0b0d12',
    theme_color: '#0b0d12',
    categories: ['photo', 'utilities'],
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
