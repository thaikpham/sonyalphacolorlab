import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware replacements for next/link and the router. Use these everywhere
 * instead of next/link, or a Vietnamese visitor clicking a card lands back in
 * English.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
