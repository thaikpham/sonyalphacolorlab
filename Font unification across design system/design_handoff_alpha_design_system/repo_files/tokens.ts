/**
 * THE source of truth for every colour, radius, font stack and breakpoint
 * shared across the Sony Alpha ecosystem — Alpha ColorLab, Sony Wiki,
 * CheeseBooth and Sony Live SOP.
 *
 * v2 — three things changed and nothing else is negotiable:
 *
 *  1. ONE family. 'Noto Sans', self-hosted from /public/fonts. The mono
 *     stack is gone: Noto Sans carries true tabular figures, so machine
 *     values align with `font-variant-numeric: tabular-nums` and stop
 *     reading like server logs.
 *  2. A 13px floor. Nothing in this ecosystem sets type below --text-label.
 *     If a label must recede, drop its weight or step down the ink ramp —
 *     never its size, and never its contrast.
 *  3. Blue + purple on a blue-black ground. Sony is black and white with a
 *     cool accent; red belongs to Canon, yellow to Nikon, green to Fuji.
 *     None of the three appears in this file, including in a ramp step.
 *
 * Edit this file and nothing else. `npm run tokens:emit` regenerates
 * dist/tokens.css and dist/theme.css and syncs both into each app. A drift
 * test in every repo fails if a generated file is hand-edited.
 *
 * Values are OKLCH so the per-recipe accents computed in ColorLab
 * (src/lib/camera/color.ts) sit in the same space as the interface.
 * Never introduce an sRGB hex here.
 */

export interface TokenGroup {
  /** Rendered as a comment above the group in both generated files. */
  readonly comment: string
  readonly tokens: Readonly<Record<string, string>>
}

/**
 * Surfaces. Dark only by design: recipes are judged by their colour and a
 * light ground changes how every accent reads. The ground is a blue-black,
 * not a neutral one — a true grey next to a cool accent reads as a dead
 * monitor.
 */
export const SURFACES: TokenGroup = {
  comment:
    'The ground, and the three glass layers over it. `void` is the page — the\n' +
    'only opaque surface in the system. Everything above it is a translucent\n' +
    'white film that reads as depth because of its blur and its shadow, not\n' +
    'because of a lighter fill.\n' +
    '\n' +
    'There is no `edge` token and no border anywhere. A stroke round a\n' +
    'component makes it read as boxed in; separation comes from transparency,\n' +
    'blur, drop shadow and the 1px specular highlight along the top edge\n' +
    '(`--elevation-spec`). A tinted grey block on a dark ground also costs the\n' +
    'text its contrast, which is the other half of the feedback this answers.',
  tokens: {
    void: 'oklch(7.5% 0.010 275)',             /* #07080B — page, opaque       */
    glass: 'oklch(100% 0 0 / 0.05)',           /* panel, card                  */
    'glass-raised': 'oklch(100% 0 0 / 0.085)', /* dropdown, dock, sheet        */
    sunken: 'oklch(0% 0 0 / 0.35)',            /* input, segmented-control rut */
  },
}

export const INK: TokenGroup = {
  comment:
    'Text, in three weights of attention — and three is the floor, not a\n' +
    'stylistic choice. Measured on the #07080B ground: ink 18.4:1,\n' +
    'ink-muted 11.1:1, ink-faint 6.1:1, all clearing WCAG AA. A fourth,\n' +
    'dimmer step is what everyone reaches for next; Live SOP had one\n' +
    "(Tailwind's gray-500) and it measured 4.24:1 on text set at 9px.\n" +
    'Do not add a step below ink-faint.\n' +
    '\n' +
    'On a tinted accent field, body text is PURE WHITE and its label is step\n' +
    '200–300 of that same ramp — never an ink step, and never a darker step of\n' +
    'the field colour. Dark type on a dark field is the exact defect this\n' +
    'system was rebuilt to remove.',
  tokens: {
    ink: 'oklch(96.5% 0.004 275)',         /* #F4F5F8 */
    'ink-muted': 'oklch(82.5% 0.012 275)', /* #C3C7D2 */
    'ink-faint': 'oklch(67.5% 0.016 275)', /* #969CAA */
  },
}

/**
 * Accent. ONE role, used for the primary action, the current selection and
 * emphasis on a number — nothing else. On this ground use step 400 for text
 * and icons, 500 for a solid fill, 900 for a tinted field.
 */
export const ACCENT: TokenGroup = {
  comment:
    'Accent ramp — Alpha blue. Step 500 is the fill, 400 the on-dark text\n' +
    'step (500 on a dark ground measures under AA for body copy), 600 the\n' +
    'pressed state, 900 a tinted field. Prefer a ramp step over an ad-hoc\n' +
    'color-mix().',
  tokens: {
    'accent-100': 'oklch(95.5% 0.020 268)',
    'accent-200': 'oklch(89.5% 0.045 268)',
    'accent-300': 'oklch(81.5% 0.080 268)',
    'accent-400': 'oklch(71.5% 0.125 268)', /* #8A9CFF — text/icon on dark */
    'accent-500': 'oklch(58.5% 0.190 268)', /* #5C74F0 — fill */
    'accent-600': 'oklch(50.5% 0.185 268)', /* pressed */
    'accent-700': 'oklch(41.5% 0.160 268)',
    'accent-800': 'oklch(31.5% 0.135 268)',
    'accent-900': 'oklch(23.5% 0.105 268)', /* tinted field */
  },
}

/**
 * Signal colours — named for what they MEAN, so a reader can tell competing
 * offers apart before reading a word. Purple, cyan and orchid only: they are
 * the three hues that stay distinct from the blue accent on a dark ground
 * without borrowing a competitor's signature.
 */
export const SIGNALS: TokenGroup = {
  comment:
    'Signal colours, named for meaning, used ONLY to classify content —\n' +
    'never as decoration, and never more than two in one row. Hue choice is\n' +
    'constrained: no red (Canon), no yellow (Nikon), no green (Fuji).\n' +
    'danger is a rose, deliberately not a fire-engine red.',
  tokens: {
    community: 'oklch(72.5% 0.095 205)', /* #46B3C4 cyan  — contributed photos */
    proposal: 'oklch(65.5% 0.165 292)',  /* #9B7BF0 violet — pending versions  */
    ai: 'oklch(67.5% 0.140 320)',        /* #C77BD9 orchid — AI tweak          */
    danger: 'oklch(62.5% 0.165 15)',     /* #E05B6E rose   — destructive/error  */
    /* A heart vote is the warmest thing a reader can do and must not read as
       an error, so it is the accent, not danger. */
    heart: 'oklch(65.5% 0.165 292)',
  },
}

/**
 * Non-colour tokens, emitted verbatim in both flavours.
 */
export const TYPOGRAPHY: TokenGroup = {
  comment:
    "One family. 'Noto Sans' is what @font-face declares in every app —\n" +
    'the literal name matters, because it is the only thing the four apps\n' +
    'share. Faces are self-hosted from /public/fonts/noto-sans, latin +\n' +
    'vietnamese subsets only: latin-ext measured ~330KB and +2s LCP for\n' +
    'languages nothing here is written in.\n' +
    '\n' +
    'There is no --font-mono and no --font-display. Both existed, both were\n' +
    'a second personality, and the mismatch between them is what the\n' +
    'feedback called "font không đồng đều". Machine values get\n' +
    'font-variant-numeric: tabular-nums, not another typeface.',
  tokens: {
    sans: "'Noto Sans', ui-sans-serif, system-ui, sans-serif",
  },
}

export const TEXT: TokenGroup = {
  comment:
    'The type scale — ten steps, and a size outside it is a bug, including\n' +
    'inside a Tailwind arbitrary value. `label` (13px) is the FLOOR: the\n' +
    'audit in DESIGN.md fails the build on text-[9px], text-[10px] and\n' +
    'text-[0.65rem], of which this repo had 68.',
  tokens: {
    'display-xl': '3.5rem',  /* 56 — one hero per app        */
    display: '2.625rem',     /* 42 — page title              */
    'title-1': '2rem',       /* 32 — recipe / camera name    */
    'title-2': '1.5625rem',  /* 25 — section                 */
    'title-3': '1.3125rem',  /* 21 — card title              */
    'body-lg': '1.125rem',   /* 18 — lede                    */
    body: '0.9375rem',       /* 15 — DEFAULT, all reading    */
    'body-sm': '0.875rem',   /* 14 — table cell, spec, hint  */
    label: '0.8125rem',      /* 13 — eyebrow/badge, 600/.08em*/
    meta: '0.8125rem',       /* 13 — author, count — FLOOR    */
  },
}

export const RADIUS: TokenGroup = {
  comment:
    'Soft, iOS-scale radii. With no strokes to describe an edge, the radius\n' +
    'and the shadow are what make a surface legible as an object — a 4px\n' +
    'corner on a borderless translucent panel reads as a rendering artefact.\n' +
    '`squircle` is a percentage on purpose: it is the only way a superellipse\n' +
    'stays one at every tile size, and it is reserved for the launcher.',
  tokens: {
    sm: '12px',        /* tag, chip, table row                      */
    md: '14px',        /* button, input, segmented option           */
    lg: '26px',        /* panel, card                               */
    xl: '32px',        /* the largest glass slab on a page          */
    squircle: '22.4%', /* launcher tile — Apple's icon superellipse */
  },
}

/**
 * Elevation. Three levels, and each is a whole recipe: blur, film, shadow and
 * specular line are not independently tunable. A level-1 shadow under a
 * level-3 blur is what made the old glass cards read as arbitrary.
 */
export const ELEVATION: TokenGroup = {
  comment:
    'Elevation recipes — use a level whole. `1` a panel, `2` anything that\n' +
    'floats over one, `3` a modal. `spec` is the 1px specular highlight that\n' +
    'stands in for a top border; `inset` is the pressed-in shadow an input\n' +
    'gets; `halo` is the coloured bloom under a filled accent control — the\n' +
    'only glow in the system apart from the launcher. Never add a border to\n' +
    'any of them.',
  tokens: {
    blur: 'blur(30px) saturate(1.35)',
    'blur-strong': 'blur(40px) saturate(1.4)',
    spec: 'inset 0 1px 0 oklch(100% 0 0 / 0.11)',
    inset: 'inset 0 2px 8px oklch(0% 0 0 / 0.5)',
    '1': '0 2px 6px oklch(0% 0 0 / 0.5), 0 18px 44px -14px oklch(0% 0 0 / 0.7)',
    '2': '0 4px 12px oklch(0% 0 0 / 0.55), 0 34px 84px -22px oklch(0% 0 0 / 0.85)',
    '3': '0 8px 24px oklch(0% 0 0 / 0.6), 0 48px 120px -30px oklch(0% 0 0 / 0.9)',
    halo: '0 12px 28px -8px var(--accent-halo)',
  },
}

export const BREAKPOINTS: TokenGroup = {
  comment:
    "Beyond Tailwind's default 2xl (96rem). Declared as tokens rather than\n" +
    'written inline as `min-[2100px]:` — Tailwind v4 silently generates no\n' +
    'rule for that arbitrary form, so a column count just never changes.',
  tokens: {
    '3xl': '131.25rem' /* 2100px */,
    '4xl': '175rem' /* 2800px */,
  },
}

export const LAYOUT: TokenGroup = {
  comment:
    'Spacing rhythm on a 4px grid, plus the 44px minimum touch target —\n' +
    'a WCAG target-size requirement everywhere, not a kiosk quirk.',
  tokens: {
    'touch-target': '44px',
    'shell-padding': 'clamp(20px, 2vw, 40px)',
    'tile-desktop': '132px',
    'tile-mobile': '76px',
    gap: 'clamp(16px, 1.4vw, 24px)',
    'gap-tight': 'clamp(10px, 1vw, 16px)',
  },
}

/** Every colour group, in emit order. Emitted under `--color-*`. */
export const COLOR_GROUPS: readonly TokenGroup[] = [SURFACES, INK, ACCENT, SIGNALS]

/** Groups emitted under their own Tailwind namespace. */
export const NAMESPACED_GROUPS: ReadonlyArray<{
  readonly namespace: string
  readonly group: TokenGroup
}> = [
  { namespace: 'font', group: TYPOGRAPHY },
  { namespace: 'text', group: TEXT },
  { namespace: 'radius', group: RADIUS },
  { namespace: 'elevation', group: ELEVATION },
  { namespace: 'breakpoint', group: BREAKPOINTS },
  { namespace: 'layout', group: LAYOUT },
]

/**
 * Values that are NOT tokens and must stay per-app:
 *
 *  - `--accent`  ColorLab overrides it per recipe from that recipe's White
 *                Balance. It must resolve to a step of the accent ramp's
 *                lightness or lighter, so it never falls under AA.
 *  - safe-area insets  read from `env()` at the point of use, not stored.
 */
export const APP_SPECIFIC = ['--accent', '--accent-halo'] as const

/**
 * The one sanctioned exception to everything above.
 *
 * The ecosystem launcher's squircle tiles carry a rotating seven-colour
 * spectral glow — two conic-gradient layers, 18s, behind an opaque icon face.
 * It is the only place in the ecosystem that may use a multi-hue gradient, a
 * rotating animation, or a radius outside RADIUS, and the only place the
 * competitor-hue rule is relaxed: a full spectrum contains every hue by
 * definition, which is the point — it belongs to no brand.
 *
 * It stays an exception by being rare. Reuse it on a card, a badge or a header
 * and the launcher stops being the ecosystem's signature — at which point it
 * should be deleted from there too, because a spectrum applied twice is
 * decoration.
 */
export const LAUNCHER_GLOW = [
  '#ff2d6f',
  '#ff8a3d',
  '#ffd93d',
  '#3ddc84',
  '#35d0e8',
  '#4a7dff',
  '#a86bff',
] as const
