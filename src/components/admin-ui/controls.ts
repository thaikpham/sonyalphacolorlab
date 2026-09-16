/**
 * The control treatments every admin screen repeats, in one place.
 *
 * There were two copies. `admin/admin-editor.tsx` declared FIELD, FIELD_SM and
 * AREA as module-private constants; `lab/admin/ui.ts` re-declared the same
 * three plus SELECT, with a header explaining that importing them would make a
 * 1,175-line client component a dependency of the article editor. That header
 * was right about the problem and wrong about the fix — the four shapes belong
 * to the design system, not to either screen, so they live beside neither.
 *
 * A control is `surface-sunken`: black 35% with an inset shadow and no stroke
 * (DESIGN.md rule 4), and every one of them clears the 44px touch target.
 */

export const FIELD =
  'w-full px-4 min-h-[var(--layout-touch-target)] surface-sunken text-body text-ink placeholder:text-ink-faint';

export const FIELD_SM =
  'w-full px-3 min-h-[var(--layout-touch-target)] surface-sunken text-body-sm text-ink placeholder:text-ink-faint';

export const AREA =
  'w-full px-4 py-3 surface-sunken text-body text-ink leading-relaxed resize-y placeholder:text-ink-faint';

/** A `<select>` needs the padding on the right for its own indicator. */
export const SELECT =
  'w-full pl-4 pr-9 min-h-[var(--layout-touch-target)] surface-sunken text-body-sm text-ink cursor-pointer';

/**
 * A 13px chip on a white film. Written out rather than using `.chip` where the
 * tint has to say what the row *is*: `.chip` is unlayered CSS and silently
 * beats a `text-*` utility on its own element.
 */
export const TAG = 'text-label font-semibold px-2.5 py-1 rounded-sm shadow-[var(--elevation-spec)]';
export const TAG_NEUTRAL = `${TAG} bg-white/[0.08] text-ink-muted`;
