import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

/**
 * Whether the bearer token belongs to an admin.
 *
 * The admin UI calls this to decide what to render. It is a convenience for the
 * client, never the gate: the page shows nothing useful without it, but every
 * write route calls `requireAdmin()` again for itself. A UI check that the
 * server trusts is not a check.
 *
 * The response says only yes or no plus the caller's own address — never the
 * allowlist, and never whether some *other* address is on it.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ isAdmin: false }, { status: 200 });
  return NextResponse.json({ isAdmin: true, email: admin.email, name: admin.name });
}
