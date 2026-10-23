import type { EditorBusy, EditorStatus } from '../admin/use-article-editor'

export type SaveLine = { kind: 'saving' | 'err' | 'unsaved' | 'ok' | 'savedAt' | 'none'; msg?: string }

/**
 * Which line the rail's save status reads, in order of what matters most.
 *
 * `saved` is the translated plain "Saved." message. An edit never clears
 * `status`, so a plain "Saved." from before the edit must not keep reading
 * after it — that is what `dirty` guards, and why it comes before an `ok`
 * status. Past that point an `ok` status is only shown when it says more than
 * "saved": a dropped-block count, "published" or "created" — text the save
 * line would otherwise swallow. The plain message gives way to the save-time
 * line instead, which is the more useful fact once there is nothing left to
 * explain.
 */
export function saveLine({
  busy,
  status,
  dirty,
  savedAt,
  saved,
}: {
  busy: EditorBusy
  status: EditorStatus
  dirty: boolean
  savedAt: Date | null
  saved: string
}): SaveLine {
  if (busy === 'saving') return { kind: 'saving' }
  if (status?.kind === 'err') return { kind: 'err', msg: status.msg }
  if (dirty) return { kind: 'unsaved' }
  if (status?.kind === 'ok' && status.msg !== saved) return { kind: 'ok', msg: status.msg }
  if (savedAt) return { kind: 'savedAt' }
  return { kind: 'none' }
}
