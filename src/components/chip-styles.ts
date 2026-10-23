/**
 * The two states of every filter chip — the header's wiki console and the
 * catalogue's browse row draw the same object.
 *
 * Deliberately NOT `chip chip-action surface-selected`. `.chip` and
 * `.surface-selected` are both unlayered and `.chip` is written *after*
 * `.surface-selected` in globals.css, so on one element the chip's own white
 * film and specular shadow win and the selection renders as an ordinary chip —
 * and `.chip-action:hover` would repaint the accent fill white on top of that.
 * The selected state therefore carries `.surface-selected` plus the chip's
 * geometry as utilities. Both land on the same 44px touch target and the same
 * 12px radius, so the two states are the same object.
 *
 * A plain module with no React in it, so a server component and the client
 * header can both import it without either pulling the other's dependencies.
 */
export const CHIP_IDLE = 'chip chip-action shrink-0 whitespace-nowrap';
export const CHIP_SELECTED =
  'surface-selected shrink-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap ' +
  'px-3 min-h-[var(--layout-touch-target)] text-label font-semibold text-ink cursor-pointer';
