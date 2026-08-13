/**
 * THE source of truth for every colour, radius, font stack and breakpoint
 * shared across the Sony Alpha ecosystem — Alpha ColorLab, CheeseBooth and
 * Sony Live SOP.
 *
 * Edit this file and nothing else. `npm run tokens:emit` regenerates
 * dist/tokens.css (plain custom properties, for consumers without Tailwind)
 * and dist/theme.css (a Tailwind v4 `@theme static` block), then syncs both
 * into each app. A drift test in every repo fails if a generated file is
 * hand-edited or falls behind this one.
 *
 * Values are OKLCH so that per-recipe accents computed in ColorLab
 * (src/lib/camera/color.ts) sit in the same space as the interface around
 * them. Never introduce an sRGB hex here.
 */

export interface TokenGroup {
  /** Rendered as a comment above the group in both generated files. */
  readonly comment: string
  readonly tokens: Readonly<Record<string, string>>
}

/**
 * Colours. In the Tailwind flavour these are emitted under the `--color-*`
 * namespace, which is what generates `bg-void`, `text-ink-muted`,
 * `border-edge` and friends. Keep the names semantic — `raised` says what the
 * surface is for, `oklch(21% …)` does not.
 */
export const SURFACES: TokenGroup = {
  comment:
    'Surfaces, darkest to lightest. `void` is the page, `base` a panel, `raised` a\n' +
    'card on that panel, `edge` a hairline. Dark only by design: recipes are\n' +
    'judged by their colour and a light surface changes how every accent reads.',
  tokens: {
    void: 'oklch(13% 0.012 265)',
    base: 'oklch(16% 0.014 265)',
    raised: 'oklch(21% 0.016 265)',
    edge: 'oklch(32% 0.018 265)',
  },
}

export const INK: TokenGroup = {
  comment:
    'Text, in three weights of attention — and three is the floor, not a\n' +
    'stylistic choice. Measured against the #040406 page: ink 11.7:1,\n' +
    'ink-muted 11.7:1, ink-faint 7.1:1, all clearing WCAG AA. A fourth, dimmer\n' +
    "step is what everyone reaches for next; Live SOP had one (Tailwind's\n" +
    'gray-500, L55%) and it measured 4.24:1 — under the 4.5:1 AA floor, on\n' +
    'text set at 9px. Do not add a step below ink-faint. If a label needs to\n' +
    'recede further, reduce its size or weight, not its contrast.',
  tokens: {
    ink: 'oklch(98% 0.004 265)',
    'ink-muted': 'oklch(82% 0.012 265)',
    'ink-faint': 'oklch(68% 0.014 265)',
  },
}

/**
 * Signal colours — named for what they MEAN, not for the hue, so a reader can
 * tell competing offers apart before reading a word. These replace Tailwind's
 * default `emerald-*` / `purple-*` / `amber-*`, which are sRGB and sit visibly
 * outside an OKLCH interface.
 *
 * They must be emitted even when no utility references them: ColorLab reads
 * `--color-proposal` only through `var()` from `.accent-glow`, which Tailwind's
 * scanner cannot see. That is why the generated theme uses `@theme static`.
 */
export const SIGNALS: TokenGroup = {
  comment:
    'Signal colours, named for meaning. Use with opacity modifiers\n' +
    '(bg-community/15, border-proposal/30) rather than reaching for a\n' +
    'neighbouring step on some other scale.\n' +
    'Updated from Adobe Color "My Color Theme" (Happy Palette):\n' +
    '#47F5D7 (Electric Mint Cyan), #F5F147 (Electric Happy Yellow),\n' +
    '#9247F5 (Electric Purple), #F57847 (Coral Sunset Orange).',
  tokens: {
    community: 'oklch(86.5% 0.175 174)',
    proposal: 'oklch(60.5% 0.27 292)',
    ai: 'oklch(91.5% 0.20 102)',
    danger: 'oklch(68.5% 0.20 42)',
    // Separate from danger on purpose: a heart vote is the warmest thing a
    // reader can do, and it must not read as an error.
    heart: 'oklch(68.5% 0.20 42)',
  },
}

/**
 * Non-colour tokens. These are emitted verbatim in both flavours — Tailwind
 * picks `--font-*`, `--radius-*` and `--breakpoint-*` up as their own
 * namespaces, and a plain-CSS consumer just reads them through `var()`.
 */
export const TYPOGRAPHY: TokenGroup = {
  comment:
    'Font stacks. The family names are what @font-face declares; each app\n' +
    'supplies the faces itself, latin + vietnamese subsets only — never\n' +
    'latin-ext, which Lighthouse measured at ~330KB and +2s LCP for languages\n' +
    'nothing in this ecosystem is written in.',
  tokens: {
    sans: "'Noto Sans', ui-sans-serif, system-ui, sans-serif",
    display: "'Noto Sans Display', 'Noto Sans', ui-sans-serif, system-ui, sans-serif",
    mono: "'Noto Sans Mono', ui-monospace, monospace",
  },
}

export const RADIUS: TokenGroup = {
  comment: 'The one radius the glass primitive uses.',
  tokens: {
    glass: '1.125rem',
  },
}

export const BREAKPOINTS: TokenGroup = {
  comment:
    'Beyond Tailwind\'s default 2xl (96rem). Declared as tokens rather than\n' +
    'written inline as `min-[2100px]:` — Tailwind v4 silently generates no rule\n' +
    'for that arbitrary form, so a column count just never changes.',
  tokens: {
    '3xl': '131.25rem' /* 2100px */,
    '4xl': '175rem' /* 2800px */,
  },
}

/**
 * Layout rhythm, contributed by CheeseBooth. A kiosk is read at arm's length
 * on a touch screen, which forced a fluid scale and an explicit minimum touch
 * target long before the other two apps needed one. Shared because the floor
 * it sets — 44px — is a WCAG target-size requirement everywhere, not a kiosk
 * quirk.
 */
export const LAYOUT: TokenGroup = {
  comment: 'Fluid layout rhythm and the 44px minimum touch target.',
  tokens: {
    'touch-target': '44px',
    'shell-padding': 'clamp(18px, 2vw, 34px)',
    gap: 'clamp(14px, 1.4vw, 24px)',
    'gap-tight': 'clamp(10px, 1vw, 16px)',
  },
}

/** Every colour group, in emit order. Emitted under `--color-*`. */
export const COLOR_GROUPS: readonly TokenGroup[] = [SURFACES, INK, SIGNALS]

/** Groups emitted under their own Tailwind namespace. */
export const NAMESPACED_GROUPS: ReadonlyArray<{
  readonly namespace: string
  readonly group: TokenGroup
}> = [
  { namespace: 'font', group: TYPOGRAPHY },
  { namespace: 'radius', group: RADIUS },
  { namespace: 'breakpoint', group: BREAKPOINTS },
  { namespace: 'layout', group: LAYOUT },
]

/**
 * Values that are NOT tokens and must stay per-app:
 *
 *  - `--accent`  ColorLab overrides it per recipe from that recipe's White
 *                Balance. The other two apps have no such concept; each sets
 *                its own default in its own stylesheet.
 *  - page background  ColorLab paints `html` at oklch(6% 0.005 265) and `body`
 *                at #040406 for OLED. A kiosk running fullscreen on an LCD has
 *                no reason to inherit that.
 *  - safe-area insets  read from `env()` at the point of use, not stored.
 */
export const APP_SPECIFIC = ['--accent'] as const
