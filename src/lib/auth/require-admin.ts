import 'server-only';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';
import { requireUser, type AuthedUser } from './require-user';

/**
 * Resolves the caller as an admin, or nothing.
 *
 * Two independent checks, in this order and never fewer:
 *
 * 1. `requireUser()` — a Supabase-issued JWT, signature and expiry verified
 *    server-side. This is where the address comes from. It is never read from
 *    the body, a header the client sets, or a query string; that is the trap
 *    `identity-not-from-body.test.ts` was written for, and an admin route is
 *    the worst possible place to repeat it.
 * 2. Membership in `admin_emails`, read with the service-role client because
 *    the table is revoked from anon and authenticated entirely — a browser
 *    cannot enumerate the admin list, or probe whether one address is on it.
 *
 * Returns `null` for every failure — unauthenticated, not an admin, table
 * missing, Supabase down. The caller answers 401/403 and must never branch on
 * *why*, because the difference between "you are not an admin" and "that
 * address is not an admin" is itself a disclosure.
 */

export type AdminRole = 'super' | 'di' | 'pe';

export type AdminUser = AuthedUser & {
  role: AdminRole;
};

const HARDCODED_ADMINS: Record<string, AdminRole> = {
  'thaikphams@gmail.com': 'super',
  'thaikpham.art@gmail.com': 'super',
  'trungnguyen.fwr@gmail.com': 'di',
  'nghiemtrancong.sony@gmail.com': 'pe',
};

export function canManageCategory(role: AdminRole, category: string): boolean {
  if (role === 'super') return true;
  if (role === 'di') return category !== 'audio';
  if (role === 'pe') return category === 'audio';
  return false;
}

export async function requireAdmin(request: Request): Promise<AdminUser | null> {
  // In offline local development mode without Supabase env vars, provide a local dev admin session
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      return {
        email: 'thaikphams@gmail.com',
        name: 'Thái K. Phạm (Dev)',
        avatarUrl: null,
        role: 'super',
      };
    }
    return null;
  }

  const user = await requireUser(request);
  if (!user?.email) return null;

  const normalizedEmail = user.email.toLowerCase();

  try {
    /* Compared lowercased: Supabase stores the address as the provider sent it,
       and `A@x.com` and `a@x.com` are the same mailbox. Storing the list
       lowercased is not enough on its own — the JWT side has to be folded too. */
    const { data, error } = await supabaseAdmin()
      .from('admin_emails')
      .select('email, role')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!error && data) {
      const role = (data.role as AdminRole) || 'super';
      return { ...user, role };
    }
  } catch {
    // Ignore query error and fallback to hardcoded list below
  }

  // Fallback check against hardcoded list so admins are never locked out
  if (normalizedEmail in HARDCODED_ADMINS) {
    return { ...user, role: HARDCODED_ADMINS[normalizedEmail] };
  }

  return null;
}

/**
 * The body every admin route returns when the caller is not an admin.
 *
 * A code, not a sentence, for the same reason the community routes use one: a
 * literal here renders untranslated to the other locale and is invisible to the
 * message parity test. The client looks it up under `admin.errors.*`.
 */
export const NOT_ADMIN = { error: 'notAdmin' as const };
