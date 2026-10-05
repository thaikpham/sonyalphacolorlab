'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { FIELD_SM, SELECT } from '@/components/admin-ui/controls'
import { CONCEPTS, CONCEPT_GROUP_LABELS, type ConceptGroup } from '@/lib/content/concepts'
import { KNOWLEDGE_SECTIONS } from '@/lib/lab/meta'
import type { ArticleKind, ArticleMeta, ContentRef, ContentRefKind } from '@/lib/lab/types'

/**
 * The editorial facts beside an article's body (ADR 0002): related entities,
 * prerequisites, the concepts a page explains, sources, a public author name,
 * a review date, and a knowledge page's place in the hub.
 *
 * The working copy is all strings — a source row being typed has an empty URL
 * for a while, and a half-typed id is not yet an id. `toMetaPayload()` drops
 * rows that are wholly empty before saving; everything else goes to the
 * server as typed, where `parseMeta()` is the one validator and reports what
 * it refused. Validating twice, differently, is how a field ends up accepted
 * on screen and silently dropped on save.
 */

export type SourceDraft = {
  url: string
  title: string
  publisher: string
  section: string
  checkedAt: string
  scope: string
}

export type MetaDraft = {
  related: { kind: ContentRefKind; id: string }[]
  prerequisites: string[]
  concepts: string[]
  sources: SourceDraft[]
  authorName: string
  reviewedAt: string
  section: string
  order: string
}

export type RefOptions = {
  recipes: { id: string; name: string; published: boolean }[]
  products: { id: string; name: string; code: string; category: string }[]
  pages: { id: string; title: string; kind: ArticleKind; status: string }[]
}

const REF_KINDS: readonly ContentRefKind[] = ['recipe', 'product', 'article', 'knowledge']

const blankSource = (): SourceDraft => ({
  url: '',
  title: '',
  publisher: '',
  section: '',
  checkedAt: '',
  scope: '',
})

export function toMetaDraft(meta: ArticleMeta): MetaDraft {
  return {
    related: meta.related.map((r) => ({ ...r })),
    prerequisites: [...meta.prerequisites],
    concepts: [...meta.concepts],
    sources: meta.sources.map((s) => ({
      url: s.url,
      title: s.title,
      publisher: s.publisher ?? '',
      section: s.section ?? '',
      checkedAt: s.checkedAt ?? '',
      scope: s.scope ?? '',
    })),
    authorName: meta.authorName ?? '',
    reviewedAt: meta.reviewedAt ?? '',
    section: meta.section ?? '',
    order: meta.order === null ? '' : String(meta.order),
  }
}

export const emptyMetaDraft = (): MetaDraft => ({
  related: [],
  prerequisites: [],
  concepts: [],
  sources: [],
  authorName: '',
  reviewedAt: '',
  section: '',
  order: '',
})

/** What goes over the wire. Wholly empty rows are the only thing dropped here. */
export function toMetaPayload(draft: MetaDraft, kind: ArticleKind): Record<string, unknown> {
  const order = draft.order.trim() === '' ? null : Number(draft.order)
  return {
    related: draft.related.filter((r) => r.id.trim()).map((r) => ({ kind: r.kind, id: r.id.trim() })),
    prerequisites: draft.prerequisites.map((p) => p.trim()).filter(Boolean),
    concepts: draft.concepts,
    sources: draft.sources
      .filter((s) => Object.values(s).some((v) => v.trim()))
      .map((s) =>
        Object.fromEntries(Object.entries(s).filter(([, v]) => v.trim() !== '')),
      ),
    authorName: draft.authorName,
    reviewedAt: draft.reviewedAt,
    /* A section and an order mean nothing on a blog article; sending them
       would store a fact no surface reads. */
    section: kind === 'knowledge' ? draft.section : '',
    order: kind === 'knowledge' ? order : null,
  }
}

function idOptions(kind: ContentRefKind, refs: RefOptions | null) {
  if (!refs) return []
  switch (kind) {
    case 'recipe':
      return refs.recipes.map((r) => ({ value: r.id, label: r.name }))
    case 'product':
      return refs.products.map((p) => ({ value: p.id, label: p.code ? `${p.name} · ${p.code}` : p.name }))
    case 'article':
    case 'knowledge':
      return refs.pages.filter((p) => p.kind === kind).map((p) => ({ value: p.id, label: p.title }))
  }
}

export function MetaEditor({
  kind,
  meta,
  onChange,
  refs,
  refsFailed,
  unknownRefs,
}: {
  kind: ArticleKind
  meta: MetaDraft
  onChange: (next: MetaDraft) => void
  refs: RefOptions | null
  refsFailed: boolean
  unknownRefs: readonly ContentRef[]
}) {
  const t = useTranslations('labAdmin')
  const uid = useId()
  const set = (patch: Partial<MetaDraft>) => onChange({ ...meta, ...patch })
  const listId = (kind: ContentRefKind) => `${uid}-ids-${kind}`
  const pagesListId = `${uid}-pages`

  const toggleConcept = (key: string) =>
    set({
      concepts: meta.concepts.includes(key)
        ? meta.concepts.filter((c) => c !== key)
        : [...meta.concepts, key],
    })

  const groups: ConceptGroup[] = ['wb', 'pp', 'cl']

  return (
    <div className="surface flex flex-col gap-5 px-5 py-5">
      <p className="label text-accent-400">{t('metaHeading')}</p>

      {/* One datalist per kind, shared by every row of that kind. Suggestions
          only — the server is the validator, and it reports an id it cannot
          find rather than this list refusing one it has not loaded. */}
      {REF_KINDS.map((k) => (
        <datalist key={k} id={listId(k)}>
          {idOptions(k, refs).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </datalist>
      ))}
      <datalist id={pagesListId}>
        {(refs?.pages ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </datalist>
      {refsFailed ? <p className="meta text-danger">{t('refsUnavailable')}</p> : null}

      {kind === 'knowledge' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-section`} className="label">
              {t('section')}
            </label>
            <select
              id={`${uid}-section`}
              value={meta.section}
              onChange={(e) => set({ section: e.target.value })}
              className={SELECT}
            >
              <option value="">{t('sectionNone')}</option>
              {KNOWLEDGE_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`sections.${s}` as never)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-order`} className="label">
              {t('order')}
            </label>
            <input
              id={`${uid}-order`}
              type="number"
              min={0}
              max={999}
              step={1}
              value={meta.order}
              onChange={(e) => set({ order: e.target.value })}
              className={FIELD_SM}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor={`${uid}-author`} className="label">
              {t('authorName')}
            </label>
            <span className="meta">{t('authorNameHint')}</span>
          </div>
          <input
            id={`${uid}-author`}
            type="text"
            value={meta.authorName}
            onChange={(e) => set({ authorName: e.target.value })}
            maxLength={80}
            className={FIELD_SM}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-reviewed`} className="label">
            {t('reviewedAt')}
          </label>
          <input
            id={`${uid}-reviewed`}
            type="date"
            value={meta.reviewedAt}
            onChange={(e) => set({ reviewedAt: e.target.value })}
            className={FIELD_SM}
          />
        </div>
      </div>

      {/* --- related --- */}
      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1.5">{t('related')}</legend>
        {meta.related.map((r, i) => {
          const missing = unknownRefs.some((u) => u.kind === r.kind && u.id === r.id.trim())
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                aria-label={t('related')}
                value={r.kind}
                onChange={(e) =>
                  set({
                    related: meta.related.map((x, xi) =>
                      xi === i ? { kind: e.target.value as ContentRefKind, id: '' } : x,
                    ),
                  })
                }
                className={`${SELECT} w-auto basis-40`}
              >
                {REF_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`relatedKinds.${k}` as never)}
                  </option>
                ))}
              </select>
              <input
                aria-label={t('relatedId')}
                type="text"
                list={listId(r.kind)}
                value={r.id}
                onChange={(e) =>
                  set({
                    related: meta.related.map((x, xi) => (xi === i ? { ...x, id: e.target.value } : x)),
                  })
                }
                aria-invalid={missing || undefined}
                className={`${FIELD_SM} min-w-0 flex-1 basis-56 ${missing ? 'text-danger' : ''}`}
              />
              <button
                type="button"
                onClick={() => set({ related: meta.related.filter((_, xi) => xi !== i) })}
                className="chip chip-action text-danger"
              >
                {t('removeRelated')}
              </button>
            </div>
          )
        })}
        <div>
          <button
            type="button"
            onClick={() => set({ related: [...meta.related, { kind: 'recipe', id: '' }] })}
            className="chip chip-action"
          >
            {t('addRelated')}
          </button>
        </div>
      </fieldset>

      {/* --- prerequisites --- */}
      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1.5">{t('prerequisites')}</legend>
        {meta.prerequisites.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              aria-label={t('prerequisites')}
              type="text"
              list={pagesListId}
              value={p}
              onChange={(e) =>
                set({
                  prerequisites: meta.prerequisites.map((x, xi) => (xi === i ? e.target.value : x)),
                })
              }
              className={`${FIELD_SM} min-w-0 flex-1 basis-56`}
            />
            <button
              type="button"
              onClick={() => set({ prerequisites: meta.prerequisites.filter((_, xi) => xi !== i) })}
              className="chip chip-action text-danger"
            >
              {t('removePrerequisite')}
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            onClick={() => set({ prerequisites: [...meta.prerequisites, ''] })}
            className="chip chip-action"
          >
            {t('addPrerequisite')}
          </button>
        </div>
      </fieldset>

      {/* --- concepts --- */}
      <fieldset className="flex flex-col gap-3">
        <legend className="label mb-1.5">{t('concepts')}</legend>
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-1.5">
            <p className="meta">{CONCEPT_GROUP_LABELS[g]}</p>
            <ul className="flex flex-wrap gap-2">
              {CONCEPTS.filter((c) => c.group === g).map((c) => {
                const on = meta.concepts.includes(c.key)
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleConcept(c.key)}
                      /* The system's selected state: an accent-tinted fill and
                         ink text — on the admin's paper ground the ramp is
                         mirrored, so `text-ink` is what reads (CLAUDE.md rule 3). */
                      className={on ? 'chip chip-action surface-selected text-ink' : 'chip chip-action'}
                    >
                      {c.key === c.group ? CONCEPT_GROUP_LABELS[g] : c.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </fieldset>

      {/* --- sources --- */}
      <fieldset className="flex flex-col gap-3">
        <legend className="label mb-1.5">{t('sources')}</legend>
        {meta.sources.map((s, i) => {
          const field = (key: keyof SourceDraft) => ({
            value: s[key],
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              set({
                sources: meta.sources.map((x, xi) => (xi === i ? { ...x, [key]: e.target.value } : x)),
              }),
          })
          return (
            <div key={i} className="grid gap-2 rounded-md bg-glass p-3 sm:grid-cols-2">
              <input aria-label={t('sourceUrl')} placeholder={t('sourceUrl')} type="url" {...field('url')} className={`${FIELD_SM} sm:col-span-2`} />
              <input aria-label={t('sourceTitle')} placeholder={t('sourceTitle')} type="text" {...field('title')} className={`${FIELD_SM} sm:col-span-2`} />
              <input aria-label={t('sourcePublisher')} placeholder={t('sourcePublisher')} type="text" {...field('publisher')} className={FIELD_SM} />
              <input aria-label={t('sourceSection')} placeholder={t('sourceSection')} type="text" {...field('section')} className={FIELD_SM} />
              <input aria-label={t('sourceScope')} placeholder={t('sourceScope')} type="text" {...field('scope')} className={FIELD_SM} />
              <div className="flex items-center gap-2">
                <input aria-label={t('sourceCheckedAt')} type="date" {...field('checkedAt')} className={`${FIELD_SM} flex-1`} />
                <button
                  type="button"
                  onClick={() => set({ sources: meta.sources.filter((_, xi) => xi !== i) })}
                  className="chip chip-action shrink-0 text-danger"
                >
                  {t('removeSource')}
                </button>
              </div>
            </div>
          )
        })}
        <div>
          <button
            type="button"
            onClick={() => set({ sources: [...meta.sources, blankSource()] })}
            className="chip chip-action"
          >
            {t('addSource')}
          </button>
        </div>
      </fieldset>
    </div>
  )
}
