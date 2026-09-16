/**
 * The control treatments the article admin repeats, in one place.
 *
 * Copied in spirit from `admin/admin-editor.tsx` rather than imported from it:
 * that file declares them as module-private constants, and exporting them
 * would make a 1,175-line client component a dependency of this one. The four
 * shapes are the design system's, not either screen's — a control is
 * `surface-sunken` with no stroke (rule 4), and every one of them clears the
 * 44px touch target.
 */

export const FIELD =
  'w-full px-4 min-h-[var(--layout-touch-target)] surface-sunken text-body text-ink placeholder:text-ink-faint'

export const FIELD_SM =
  'w-full px-3 min-h-[var(--layout-touch-target)] surface-sunken text-body-sm text-ink placeholder:text-ink-faint'

export const AREA =
  'w-full px-4 py-3 surface-sunken text-body text-ink leading-relaxed resize-y placeholder:text-ink-faint'

/** A `<select>` needs the padding on the right for its own indicator. */
export const SELECT =
  'w-full pl-4 pr-9 min-h-[var(--layout-touch-target)] surface-sunken text-body-sm text-ink cursor-pointer'
