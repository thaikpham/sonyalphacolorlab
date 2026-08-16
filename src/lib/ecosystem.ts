/**
 * The four apps, in launcher order.
 *
 * Two surfaces render this list — the overlay in `site-header.tsx` and the
 * landing page at `/` — so it lives in one place. They were one component with
 * the list inlined; the moment a second surface needed it, a copy would have
 * been a launcher that disagrees with itself about what exists.
 *
 * **App names are not translated.** They are product names, the same category
 * as recipe names and Creative Look codes in Rule 3: "CheeseBooth" is
 * "CheeseBooth" in both locales. That is why they are here and not in
 * `messages/*.json` — a name in a message catalogue is a name somebody will
 * eventually translate.
 *
 * Two of the four are separate projects on their own repos and their own Vercel
 * deployments (Rule 6). This app cannot render them and does not try: it links
 * out to the real origin, which is why `external` is per-app rather than
 * inferred from the URL shape.
 */

export type EcosystemAppDef = {
  /** Stable key for React and for tests; never shown. */
  key: string;
  /** Product name. Never translated — see above. */
  name: string;
  /** Square PNG under `/public`, 256x256. */
  icon: string;
  href: string;
  /** Another origin → new tab. In-app routes navigate in place. */
  external: boolean;
  /**
   * Padding inside the tile, per app.
   *
   * The PNGs are bare artwork on transparency with quite different bleed (96%,
   * 90%, 82% of their own canvas), so one shared padding renders them at three
   * different optical sizes. These values land them all on roughly 70% of the
   * tile. Percentages, not `p-4`, so they hold at every tile size without a
   * breakpoint.
   */
  iconInset: string;
  /**
   * Short form for the two-column mobile grid, where a 76px tile is narrower
   * than "Live Stream SOP" set at the 13px floor. Not a translation — the same
   * product-name rule applies, this is just the name the product itself uses
   * when it has no room.
   */
  shortName: string;
};

export const ECOSYSTEM_APPS: readonly EcosystemAppDef[] = [
  {
    key: 'colorlab',
    name: 'ColorLab 2.0',
    shortName: 'ColorLab',
    icon: '/colorlab-icon.png',
    href: '/colorlab',
    external: false,
    iconInset: 'p-[13.5%]',
  },
  {
    key: 'wiki',
    name: 'Sony Wiki',
    shortName: 'Sony Wiki',
    icon: '/sony-wiki-icon.png',
    href: '/cameras',
    external: false,
    iconInset: 'p-[10%]',
  },
  {
    key: 'cheesebooth',
    name: 'CheeseBooth',
    shortName: 'CheeseBooth',
    icon: '/cheesebooth-icon.png',
    href: 'https://cheese-booth.vercel.app/',
    external: true,
    iconInset: 'p-[11%]',
  },
  {
    key: 'livesop',
    name: 'Live Stream SOP',
    shortName: 'Live SOP',
    icon: '/livesop-icon.png',
    href: 'https://sonylivesop.vercel.app/',
    external: true,
    iconInset: 'p-[7.5%]',
  },
] as const;

/**
 * Sony Wiki's two divisions, reached by tapping the Sony Wiki tile.
 *
 * `name` is not translated for the same reason the app names above are not:
 * "Digital Imaging" and "Personal Entertainment" are Sony's own division names,
 * the same category as a Creative Look code in Rule 3. What each division
 * *contains* is ordinary prose and does live in `messages/*.json`, under
 * `launcher.divisions.<key>`.
 */
export const WIKI_DIVISIONS = [
  { key: 'di', name: 'DI · Digital Imaging', mark: 'DI', href: '/cameras' },
  { key: 'pe', name: 'PE · Personal Entertainment', mark: 'PE', href: '/audio' },
] as const;
