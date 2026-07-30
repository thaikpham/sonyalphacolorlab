import { Noto_Sans, Noto_Sans_Mono } from 'next/font/google';

/**
 * Noto Sans throughout. The `vietnamese` subset is not optional: without it the
 * browser falls back for diacritics and Vietnamese renders in a mismatched face
 * mid-word — silently, with no build error. Guarded by fonts.test.ts.
 *
 * Mono is not a second personality — same superfamily, reserved for camera
 * values so they align in a column and read as machine data.
 */
export const notoSans = Noto_Sans({
  variable: '--font-noto-sans',
  // `latin-ext` is deliberately absent: this app is English + Vietnamese only,
  // and it was costing ~100KB of font for languages nothing here is written in.
  // `vietnamese` is non-negotiable — see the guard in fonts.test.ts.
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
});

export const notoSansMono = Noto_Sans_Mono({
  variable: '--font-noto-sans-mono',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  // Not preloaded: mono is only used for camera values, never for the largest
  // text on the page, so preloading it competed with the LCP element for
  // bandwidth without moving anything a reader sees first.
  preload: false,
});
