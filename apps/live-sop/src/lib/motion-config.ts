/**
 * motion-config.ts
 * Spring physics constants for the iOS-style motion language.
 *
 * These live apart from ios-motion.tsx on purpose. React Fast Refresh can only
 * hot-swap a module that exports components and nothing else — a single
 * non-component export next to them (`react-refresh/only-export-components`)
 * forces a full reload of every consumer on each edit. Keeping the constants in
 * their own module lets the primitives file stay refreshable.
 */

export const spring = {
  /** Ultra-fast for instant feedback (60fps optimized). */
  instant: { type: "spring" as const, stiffness: 800, damping: 35, mass: 0.6 },
  /** Fast snappy for hover states (60fps). */
  hover: { type: "spring" as const, stiffness: 600, damping: 32, mass: 0.7, velocity: 0 },
  /** Smooth press feedback (60fps). */
  press: { type: "spring" as const, stiffness: 700, damping: 30, mass: 0.5, velocity: 0 },
  /** Butter smooth page transitions (60fps). */
  page: {
    type: "spring" as const,
    stiffness: 400,
    damping: 40,
    mass: 0.6,
    velocity: 0,
    restDelta: 0.0001,
    restSpeed: 0.0001
  },
  /** Gentle for entrances (60fps). */
  smooth: { type: "spring" as const, stiffness: 320, damping: 30, mass: 1 },
  /** Very bouncy, for icons and accent elements. */
  bouncy: { type: "spring" as const, stiffness: 500, damping: 22, mass: 0.8 },
  /** Snappy, like UIKit spring. */
  snap: { type: "spring" as const, stiffness: 420, damping: 28, mass: 1 },
};
