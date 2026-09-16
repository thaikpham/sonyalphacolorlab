import type { Metadata } from 'next';
import { SecurityPanel } from '@/components/admin-ui/security-panel';

/**
 * Where the password and the authenticator are set up.
 *
 * Reachable only once the gate has opened, like every other admin page — the
 * shell renders the sign-in form instead of its children otherwise. That is not
 * a chicken-and-egg problem: `requireAdmin()` demands a second factor only once
 * a verified one exists, so an operator whose account came from Google
 * sign-in gets in with one factor, sets a password here, enrols the app here,
 * and from the next sign-in onward the ratchet holds.
 */

export const metadata: Metadata = {
  title: 'Bảo mật',
};

export default function AdminSecurityPage() {
  return <SecurityPanel />;
}
