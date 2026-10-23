'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { AdminSessionProvider, useAdminSession } from '@/components/admin-ui/session'
import { ARTICLE_LANG } from '@/lib/lab/articles'
import type { ArticleKind, ArticleRecord } from '@/lib/lab/types'

/**
 * Where an administrator starts a page or finds a draft, now that there is no
 * list screen: one row above the hub, for them alone. The hub itself stays
 * prerendered; this asks in the browser, like `EditLink`.
 */
export function FeedAdminRow(props: { kind: ArticleKind; create: string; drafts: string }) {
  return (
    <AdminSessionProvider probeSignedOut={false}>
      <Row {...props} />
    </AdminSessionProvider>
  )
}

function Row({ kind, create, drafts }: { kind: ArticleKind; create: string; drafts: string }) {
  const { gate, authed } = useAdminSession()
  const [rows, setRows] = useState<ArticleRecord[] | null>(null)
  const base = kind === 'knowledge' ? '/learn' : '/blog'

  useEffect(() => {
    if (gate !== 'admin') return
    let live = true
    ;(async () => {
      try {
        const res = await fetch('/api/admin/articles', { headers: authed() })
        const data = (await res.json()) as { articles?: ArticleRecord[] }
        if (live && res.ok && data.articles) {
          setRows(data.articles.filter((a) => a.status === 'draft' && a.kind === kind))
        }
      } catch {
        /* The row still offers a new page; the count is what is missing. */
      }
    })()
    return () => {
      live = false
    }
  }, [gate, authed, kind])

  if (gate !== 'admin') return null
  return (
    <div className="mx-auto w-full max-w-[160rem] inset-safe pt-6 mb-6">
      <div className="flex flex-wrap items-start gap-3">
        <Link href={`${base}/new`} className="btn-glass">
          {create}
        </Link>
        {rows && rows.length > 0 ? (
          <details className="min-w-0 flex-1">
            {/* `list-none` alone leaves WebKit's own disclosure triangle. */}
            <summary className="chip chip-action list-none [&::-webkit-details-marker]:hidden">
              {drafts} · <span className="tabular-nums">{rows.length}</span>
            </summary>
            <ul className="mt-2 flex flex-col" lang={ARTICLE_LANG}>
              {rows.map((a) => (
                <li key={a.id}>
                  <hr className="seam" />
                  <Link
                    href={`${base}/${a.id}/edit`}
                    className="flex min-h-[var(--layout-touch-target)] items-center px-2 text-body-sm font-semibold text-ink hover:text-accent-400"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  )
}
