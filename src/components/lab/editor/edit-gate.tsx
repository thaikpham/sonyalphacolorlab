'use client'

import { AdminGate } from '@/components/admin-ui/gate'
import { AdminSessionProvider } from '@/components/admin-ui/session'
import type { ArticleKind } from '@/lib/lab/types'
import { ArticleEditor } from './article-editor'

/**
 * The editor, behind the same gate the admin department uses. The `main` is
 * here, with no classes: the gate's own screens render theirs, so whichever
 * the gate shows, the route has one landmark and the route wrapper sets the
 * width and the gutter once.
 */
export function EditGate({ kind, id }: { kind: ArticleKind; id: string | null }) {
  return (
    <AdminSessionProvider>
      <AdminGate>
        <main>
          <ArticleEditor id={id} kind={kind} />
        </main>
      </AdminGate>
    </AdminSessionProvider>
  )
}
