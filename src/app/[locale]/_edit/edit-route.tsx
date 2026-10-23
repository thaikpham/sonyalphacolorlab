import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { SiteHeader } from '@/components/site-header'
import { EditGate } from '@/components/lab/editor/edit-gate'
import type { ArticleKind } from '@/lib/lab/types'

/**
 * The body of the four edit routes.
 *
 * Its provider REPLACES the layout's messages for everything inside it
 * (use-intl's IntlProvider takes `messages` whole when given), so it lists
 * every namespace the gate and the editor read, and the header stays outside
 * it. These two namespaces reach the browser on these routes only.
 */
export async function EditRoute({ kind, id }: { kind: ArticleKind; id: string | null }) {
  const messages = await getMessages()
  const clientMessages = {
    adminUi: messages.adminUi,
    labAdmin: messages.labAdmin,
  }
  return (
    <div className="theme-paper contents">
      <Suspense>
        <SiteHeader />
      </Suspense>
      <main className="mx-auto min-h-screen-dynamic w-full max-w-[86rem] inset-safe pt-8 pb-24">
        <NextIntlClientProvider messages={clientMessages}>
          <EditGate kind={kind} id={id} />
        </NextIntlClientProvider>
      </main>
    </div>
  )
}
