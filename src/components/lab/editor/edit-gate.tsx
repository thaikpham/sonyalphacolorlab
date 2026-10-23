'use client'

import { AdminGate } from '@/components/admin-ui/gate'
import { AdminSessionProvider } from '@/components/admin-ui/session'
import type { ArticleKind } from '@/lib/lab/types'
import { ArticleEditor } from './article-editor'

/** The editor, behind the same gate the admin department uses. */
export function EditGate({ kind, id }: { kind: ArticleKind; id: string | null }) {
  return (
    <AdminSessionProvider>
      <AdminGate>
        <ArticleEditor id={id} kind={kind} />
      </AdminGate>
    </AdminSessionProvider>
  )
}
