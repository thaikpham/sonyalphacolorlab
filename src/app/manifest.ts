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
    /* `--color-void`, restated as sRGB. The manifest is parsed by the OS
       installer, not by CSS, so an `oklch()` here is ignored and the splash
       screen falls back to white — the one place a dark-only app would show a
       full screen of it. Keep in step with the token. */
    background_color: '#07080B',
    theme_color: '#07080B',
    categories: ['photo', 'utilities'],
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
