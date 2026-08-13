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
  /** Staggered entrance; `app-enter-N` are defined in the VFX stylesheet. */
  enter: string;
  /** Hover colour for the name, so the four are not one undifferentiated wall. */
  accent?: string;
};

export const ECOSYSTEM_APPS: readonly EcosystemAppDef[] = [
  {
    key: 'colorlab',
    name: 'ColorLab 2.0',
    icon: '/colorlab-icon.png',
    href: '/colorlab',
    external: false,
    iconInset: 'p-[13.5%]',
    enter: 'app-enter-1',
  },
  {
    key: 'wiki',
    name: 'Sony Wiki',
    icon: '/sony-wiki-icon.png',
    href: '/cameras',
    external: false,
    iconInset: 'p-[10%]',
    enter: 'app-enter-2',
    accent: 'group-hover:text-amber-300',
  },
  {
    key: 'cheesebooth',
    name: 'CheeseBooth',
    icon: '/cheesebooth-icon.png',
    href: 'https://cheese-booth.vercel.app/',
    external: true,
    iconInset: 'p-[11%]',
    enter: 'app-enter-3',
    accent: 'group-hover:text-amber-300',
  },
  {
    key: 'livesop',
    name: 'Live Stream SOP',
    icon: '/livesop-icon.png',
    href: 'https://sonylivesop.vercel.app/',
    external: true,
    iconInset: 'p-[7.5%]',
    enter: 'app-enter-4',
    accent: 'group-hover:text-blue-300',
  },
] as const;
