import { NextResponse } from 'next/server';
import { adminGate } from '@/lib/auth/admin-gate';

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
 *
 * The 200/`isAdmin: false` shape is kept, because the admin shell reads it on
 * every page load and a 403 there would be noise. But an outage is not a `no`:
 * answering `isAdmin: false` when the control project is restricted tells an
 * administrator their account was removed, and hides the real fault behind a
 * screen that simply renders nothing. That case gets its own 503 so the shell
 * can say the right thing.
 */
export async function GET(request: Request) {
  const gate = await adminGate(request);
  if (!gate.ok) {
    if (gate.status === 503) {
      return NextResponse.json({ isAdmin: false, error: gate.error }, { status: 503 });
    }
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
  const { admin } = gate;
  return NextResponse.json({ isAdmin: true, email: admin.email, name: admin.name, role: admin.role });
}
