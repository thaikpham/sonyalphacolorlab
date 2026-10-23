'use client'

import { Link } from '@/i18n/navigation'
import { AdminSessionProvider, useAdminSession } from '@/components/admin-ui/session'

/**
 * "Sửa" on a public page, for an administrator only.
 *
 * Decided in the browser, after hydration, so the page is one prerendered copy
 * for everybody — the FeestFinder pattern (`kd/web/blog/edit-link.tsx`). A
 * reader with no session causes no request (`probeSignedOut={false}`). This is
 * a convenience, never the check: every write re-asks `adminGate()`.
 */
export function EditLink({ href, label }: { href: string; label: string }) {
  return (
    <AdminSessionProvider probeSignedOut={false}>
      <Shown href={href} label={label} />
    </AdminSessionProvider>
  )
}

function Shown({ href, label }: { href: string; label: string }) {
  const { gate } = useAdminSession()
  if (gate !== 'admin') return null
  return (
    <Link
      href={href}
      className="ml-3 inline-flex min-h-[var(--layout-touch-target)] items-center font-semibold text-accent-400 transition-colors hover:text-ink"
    >
      {label}
    </Link>
  )
}
