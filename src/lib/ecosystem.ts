/**
 * The three apps, in launcher order.
 *
 * Two surfaces render this list — the overlay in `site-header.tsx` and the
 * landing page at `/` — so it lives in one place. They were one component with
 * the list inlined; the moment a second surface needed it, a copy would have
 * been a launcher that disagrees with itself about what exists.
 *
 * **App names are not translated.** They are product names, the same category
 * as recipe names and Creative Look codes in Rule 3: "ColorLab 2.0" is
 * "ColorLab 2.0" in both locales. That is why they are here and not in
 * `messages/*.json` — a name in a message catalogue is a name somebody will
 * eventually translate.
 *
 * `external` is per-app rather than inferred from the URL shape. Nothing in the
 * list carries it right now — both entries are in-app routes — but an entry
 * pointing at another origin is a separate project on its own repo and its own
 * Vercel deployment (Rule 6), which this app cannot render and must open at the
 * real origin. That is a property of the app, not something to re-derive from
 * the href.
 */

export type EcosystemAppDef = {
  /** Stable key for React and for tests; never shown. */
  key: string;
  /** Product name. Never translated — see above. */
  name: string;
  /**
   * Square artwork under `/public`, authored on a 256x256 canvas.
   *
   * SVG for the two marks drawn for this system, PNG for ColorLab's, which
   * predates it. The launcher passes `unoptimized`, so the file is served as
   * authored and a vector stays crisp on the 198px desktop tile at 3x — which
   * a 256px raster does not.
   */
  icon: string;
  href: string;
  /** Another origin → new tab. In-app routes navigate in place. */
  external: boolean;
  /**
   * Padding inside the tile, per app. Unused by a `mark` tile, whose glyph is
   * centred by the face rather than inset.
   *
   * The PNGs are bare artwork on transparency with quite different bleed, so
   * one shared padding renders them at different optical sizes. These values
   * land them both on roughly 70% of the tile. Percentages, not `p-4`, so they
   * hold at every tile size without a breakpoint.
   */
  iconInset: string;
  /**
   * Short form for the two-column mobile grid, where a 76px tile is narrower
   * than "ColorLab 2.0" set at the 13px floor. Not a translation — the same
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
    icon: '/colorlab-icon.svg',
    href: '/colorlab',
    external: false,
    iconInset: 'p-[13.5%]',
  },
  {
    key: 'wiki',
    name: 'Sony Wiki',
    shortName: 'Sony Wiki',
    icon: '/sony-wiki-icon.svg',
    href: '/cameras',
    external: false,
    iconInset: 'p-[13.5%]',
  },
  {
    key: 'blog',
    name: 'Alpha Tech Blogs',
    shortName: 'Tech Blogs',
    icon: '/alpha-tech-blogs-icon.svg',
    href: '/blog',
    external: false,
    iconInset: 'p-[13.5%]',
  },
] as const;

/**
 * Sony Wiki's two divisions — the pair behind the DI/PE switch in the header.
 *
 * They were a second screen of launcher tiles: the Sony Wiki tile opened a
 * sub-grid and you picked a division before the app itself ever rendered. But
 * DI and PE are two catalogues inside one app, not two apps, and a doorway that
 * asks which half you want before showing you either is a question the reader
 * cannot yet answer. The switch moved to `site-header.tsx`, beside the search
 * field, where it sits next to the rest of that app's controls and can be
 * thrown at any time — so this list is now consumed by the header, and the
 * launcher's Sony Wiki tile goes straight to `/cameras`.
 *
 * `name` is not translated for the same reason the app names above are not:
 * "Digital Imaging" and "Personal Entertainment" are Sony's own division names,
 * the same category as a Creative Look code in Rule 3. `mark` is the two-letter
 * form the switch shows — the full `name` is its title and accessible name,
 * because "DI" alone tells a screen reader nothing.
 */
export const WIKI_DIVISIONS = [
  { key: 'di', name: 'DI · Digital Imaging', mark: 'DI', href: '/cameras' },
  { key: 'pe', name: 'PE · Personal Entertainment', mark: 'PE', href: '/audio' },
] as const;
