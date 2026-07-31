/**
 * ios-motion.tsx
 * Reusable iOS-style animation primitives powered by Motion (Framer Motion v11+).
 *
 * Design language:
 *  • Spring physics: stiff snap + gentle damping (feels like UIKit spring)
 *  • Scale press on every interactive element (scale 0.96 on tap)
 *  • Stagger children like iOS grid / list
 *  • Fade-up entrance with spring for every piece of content
 *  • Page transition: slide + fade + scale (like iOS push navigation)
 */

// @ts-nocheck

import { motion, AnimatePresence, type Variants, type TargetAndTransition } from "motion/react";
import { forwardRef, type ReactNode, type HTMLAttributes, type ButtonHTMLAttributes } from "react";

// ─── 60FPS Optimized Spring Configs ──────────────────────────────────

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

// ─── Page Transition ─────────────────────────────────────────────────────────

const pageVariants: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.982 },
  enter:   { opacity: 1, y: 0,  scale: 1 },
  exit:    { opacity: 0, y: -10, scale: 1.012 },
};

interface PageMotionProps {
  children: ReactNode;
  className?: string;
  /** Unique key for AnimatePresence (usually the route path). */
  routeKey?: string;
}

/**
 * Wraps a page's root element with iOS-style entrance/exit animation.
 * Just replace the outermost `<div>` in each page with `<PageMotion>`.
 */
export function PageMotion({ children, className = "", routeKey }: PageMotionProps) {
  return (
    <motion.div
      key={routeKey}
      className={className}
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      transition={spring.page}
      style={{ height: "100%", width: "100%" }}
    >
      {children}
    </motion.div>
  );
}

// ─── Fade Up ─────────────────────────────────────────────────────────────────

interface FadeUpProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  delay?: number;
  distance?: number;
  style?: React.CSSProperties;
}

/**
 * Element fades in from below with a spring on mount.
 * Ideal for section titles, hero copy, stat cards.
 */
export const FadeUp = forwardRef<HTMLDivElement, FadeUpProps>(
  ({ children, delay = 0, distance = 20, className = "", style, ...rest }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.smooth, delay }}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </motion.div>
  )
);
FadeUp.displayName = "FadeUp";

// ─── Stagger Container / Item ─────────────────────────────────────────────────

const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.05,
    },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.96 },
  show:   { opacity: 1, y: 0,  scale: 1 },
};

interface StaggerListProps {
  children: ReactNode;
  className?: string;
  /** Extra delay before the stagger starts. */
  delay?: number;
  /** Gap between each child in seconds (default 0.055). */
  stagger?: number;
}

/**
 * Container that staggers its direct `<StaggerItem>` children on mount.
 */
export function StaggerList({ children, className = "", delay = 0.05, stagger = 0.055 }: StaggerListProps) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}
StaggerList.displayName = "StaggerList";

interface StaggerItemProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Optional: override the element tag (default: div). */
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Individual child inside `<StaggerList>`.
 */
export function StaggerItem({ children, className = "", as: Tag = "div", ...rest }: StaggerItemProps) {
  const MotionTag = motion[Tag as keyof typeof motion] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      variants={staggerItem}
      transition={spring.smooth}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </MotionTag>
  );
}

// ─── Spring Card ──────────────────────────────────────────────────────────────

interface SpringCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Scale on hover (default 1.018). */
  hoverScale?: number;
  /** Scale on press (default 0.965). */
  pressScale?: number;
  /** Lift (negative y) on hover in px (default 3). */
  hoverLift?: number;
  onClick?: () => void;
}

/**
 * Card wrapper with iOS-style hover lift + press feedback.
 */
export const SpringCard = forwardRef<HTMLDivElement, SpringCardProps>(
  ({ children, className = "", hoverScale = 1.018, pressScale = 0.965, hoverLift = 3, onClick, ...rest }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      whileHover={{ scale: hoverScale, y: -hoverLift }}
      whileTap={{ scale: pressScale, y: 0 }}
      transition={spring.snap}
      onClick={onClick}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </motion.div>
  )
);
SpringCard.displayName = "SpringCard";

// ─── Spring Button ────────────────────────────────────────────────────────────

interface SpringButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  pressScale?: number;
  hoverScale?: number;
}

/**
 * Drop-in replacement for `<button>` with iOS spring press feedback.
 */
export const SpringButton = forwardRef<HTMLButtonElement, SpringButtonProps>(
  ({ children, pressScale = 0.93, hoverScale = 1.04, className = "", ...rest }, ref) => (
    <motion.button
      ref={ref}
      className={className}
      whileHover={{ scale: hoverScale }}
      whileTap={{ scale: pressScale }}
      transition={spring.snap}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  )
);
SpringButton.displayName = "SpringButton";

// ─── Slide In ─────────────────────────────────────────────────────────────────

interface SlideInProps {
  children: ReactNode;
  className?: string;
  from?: "right" | "left" | "bottom" | "top";
  delay?: number;
  distance?: number;
}

/**
 * Slides content in from a direction on mount.
 */
export function SlideIn({ children, className = "", from = "bottom", delay = 0, distance = 40 }: SlideInProps) {
  const initial: TargetAndTransition = {
    opacity: 0,
    x: from === "right" ? distance : from === "left" ? -distance : 0,
    y: from === "bottom" ? distance : from === "top" ? -distance : 0,
  };
  return (
    <motion.div
      className={className}
      initial={initial}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ ...spring.smooth, delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── Pop In (for icons, badges, dots) ────────────────────────────────────────

interface PopInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Pops in with overshoot like iOS badge / notification dot.
 */
export function PopIn({ children, className = "", delay = 0 }: PopInProps) {
  return (
    <motion.div
      className={className}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...spring.bouncy, delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── Re-export motion for convenience ────────────────────────────────────────
export { motion, AnimatePresence };
