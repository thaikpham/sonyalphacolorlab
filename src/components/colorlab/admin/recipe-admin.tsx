'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminSession } from '@/components/admin-ui/session';
import { FIELD, FIELD_SM } from '@/components/admin-ui/controls';
import { CREATIVE_LOOK_CODES, PP_RANGES, CL_RANGES, WB_KELVIN } from '@/lib/camera/constants';
import type { ClSettings, PpSettings, Recipe } from '@/lib/camera/schema';
import { PpFields, ClFields } from './settings-fields';
import { WhiteBalanceFields } from './wb-fields';
import { ImagePanel } from './image-panel';

/**
 * The ColorLab recipe editor.
 *
 * The screen ColorLab never had. Until now the only writer of a recipe in this
 * repository was `scripts/push-supabase.ts`, run from a laptop with a secret
 * key — so a typo in a colour value meant editing JSON and re-running a
 * migration script.
 *
 * Two things here differ from the other two admin screens, both on purpose:
 *
 * - **The slug is fixed at creation.** It is shown, never edited. The control
 *   plane's `recipe_comments`, `recipe_proposals`, `proposal_votes` and
 *   `community_photos` reference `recipe_slug` as a plain string across a
 *   project and organisation boundary no foreign key spans, so a rename
 *   orphans every comment on the recipe with no error and nothing to rejoin on.
 * - **Removal is "unpublish", not "delete."** Same reason, from the other
 *   direction: the row has to stay for those references to keep pointing at
 *   something. Articles and products delete for real.
 *
 * Every numeric bound and every list comes from `constants.ts` via the field
 * components — Rule 1, and the server re-validates all of it through
 * `recipeSchema` anyway, because a form is a convenience and never a check.
 */

type RecipeRecord = { recipe: Recipe; legacyId: string | null; updatedAt: string };

const DEFAULT_PP: PpSettings = {
  blackLevel: 0,
  gamma: 'Cine1',
  blackGamma: { range: 'Middle', level: 0 },
  knee: { mode: 'Auto' },
  colorMode: 'Pro',
  saturation: 0,
  colorPhase: 0,
  colorDepth: { R: 0, G: 0, B: 0, C: 0, M: 0, Y: 0 },
  detail: {
    level: 0,
    mode: 'Auto',
    vhBalance: 0,
    bwBalance: 'Type3',
    limit: PP_RANGES.detailLimit.min,
    crispening: PP_RANGES.detailCrispening.min,
    hiLightDetail: PP_RANGES.detailHiLightDetail.min,
  },
};

const DEFAULT_CL: ClSettings = {
  look: CREATIVE_LOOK_CODES[0],
  contrast: 0,
  highlights: 0,
  shadows: 0,
  fade: CL_RANGES.fade.min,
  saturation: 0,
  sharpness: CL_RANGES.sharpness.min,
  sharpnessRange: CL_RANGES.sharpnessRange.min,
  clarity: CL_RANGES.clarity.min,
};

export function RecipeAdmin() {
  const t = useTranslations('recipeAdmin');
  const { authed } = useAdminSession();

  const [records, setRecords] = useState<RecipeRecord[]>([]);
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<'' | 'saving' | 'creating' | 'unpublishing'>('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [issues, setIssues] = useState<readonly string[]>([]);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newFormat, setNewFormat] = useState<'pp' | 'cl'>('pp');

  const codeMessage = useCallback(
    (code: string) => (t.has(`errors.${code}` as never) ? t(`errors.${code}` as never) : code),
    [t],
  );

  const fetchList = useCallback(async (): Promise<RecipeRecord[] | null> => {
    try {
      const res = await fetch('/api/admin/recipes', { headers: authed() });
      const data = (await res.json()) as { recipes?: RecipeRecord[]; error?: string };
      if (!res.ok || !data.recipes) {
        setStatus({ kind: 'err', msg: codeMessage(data.error ?? 'loadFailed') });
        return null;
      }
      return data.recipes;
    } catch {
      setStatus({ kind: 'err', msg: codeMessage('loadFailed') });
      return null;
    }
  }, [authed, codeMessage]);

  const reload = useCallback(async () => {
    const rows = await fetchList();
    if (rows) setRecords(rows);
  }, [fetchList]);

  useEffect(() => {
    let live = true;
    (async () => {
      const rows = await fetchList();
      if (live && rows) setRecords(rows);
    })();
    return () => {
      live = false;
    };
  }, [fetchList]);

  /* The one guard against losing work. Nothing autosaves. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.recipe.name.toLowerCase().includes(q) ||
        r.recipe.id.toLowerCase().includes(q) ||
        r.recipe.slug.includes(q) ||
        r.recipe.tags.some((tag) => tag.includes(q)),
    );
  }, [records, query]);

  const open = (record: RecipeRecord) => {
    if (dirty && !window.confirm(t('discardConfirm'))) return;
    setDraft(record.recipe);
    setDirty(false);
    setIssues([]);
    setStatus(null);
  };

  const edit = (next: Recipe) => {
    setDraft(next);
    setDirty(true);
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) {
      setStatus({ kind: 'err', msg: codeMessage('nameRequired') });
      return;
    }
    setBusy('creating');
    try {
      const res = await fetch('/api/admin/recipes', {
        method: 'POST',
        headers: authed(),
        body: JSON.stringify({
          name,
          format: newFormat,
          whiteBalance: { mode: 'kelvin', kelvin: WB_KELVIN.min },
          tags: [],
          settings: newFormat === 'pp' ? DEFAULT_PP : DEFAULT_CL,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !data.id) {
        setStatus({ kind: 'err', msg: codeMessage(data.error ?? 'saveFailed') });
        return;
      }
      setNewName('');
      const rows = await fetchList();
      if (rows) {
        setRecords(rows);
        const made = rows.find((r) => r.recipe.id === data.id);
        if (made) {
          setDraft(made.recipe);
          setDirty(false);
        }
      }
      setStatus({ kind: 'ok', msg: t('created', { id: data.id }) });
    } catch {
      setStatus({ kind: 'err', msg: codeMessage('saveFailed') });
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    if (!draft) return;
    setBusy('saving');
    setIssues([]);
    try {
      const res = await fetch(`/api/admin/recipes/${draft.id}`, {
        method: 'PATCH',
        headers: authed(),
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        recipe?: RecipeRecord;
        error?: string;
        issues?: string[];
      };
      if (!res.ok) {
        /* The server's Zod issues, shown verbatim and per field. They name a
           path and a bound — far more use than "could not save", and the form
           cannot always prevent them: a Look change and a saturation value can
           each be legal while the pair is not. */
        if (data.issues) setIssues(data.issues);
        setStatus({ kind: 'err', msg: codeMessage(data.error ?? 'saveFailed') });
        return;
      }
      if (data.recipe) setDraft(data.recipe.recipe);
      setDirty(false);
      await reload();
      setStatus({ kind: 'ok', msg: t('saved') });
    } catch {
      setStatus({ kind: 'err', msg: codeMessage('saveFailed') });
    } finally {
      setBusy('');
    }
  };

  const unpublish = async () => {
    if (!draft || !window.confirm(t('unpublishConfirm'))) return;
    setBusy('unpublishing');
    try {
      const res = await fetch(`/api/admin/recipes/${draft.id}`, {
        method: 'DELETE',
        headers: authed(),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setStatus({ kind: 'err', msg: codeMessage(data.error ?? 'saveFailed') });
        return;
      }
      setDraft({ ...draft, published: false });
      setDirty(false);
      await reload();
      setStatus({ kind: 'ok', msg: t('unpublished') });
    } catch {
      setStatus({ kind: 'err', msg: codeMessage('saveFailed') });
    } finally {
      setBusy('');
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-[110rem] flex-wrap items-start gap-y-8 gap-x-[clamp(2rem,3vw,3.5rem)] inset-safe pb-24 pt-8">
      <aside className="flex grow basis-[clamp(16rem,20vw,22rem)] flex-col gap-4 self-start lg:sticky lg:top-6 lg:grow-0">
        <div className="flex flex-col gap-2 surface-raised p-4 rounded-md">
          <span className="label text-ink-muted">{t('newRecipe')}</span>
          <input
            className={FIELD_SM}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('newNamePlaceholder')}
          />
          <div className="flex gap-2">
            {(['pp', 'cl'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setNewFormat(f)}
                className={`flex-1 px-3 py-2 rounded-sm text-body-sm font-semibold cursor-pointer ${
                  newFormat === f ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {f === 'pp' ? t('formatPp') : t('formatCl')}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={create}
            disabled={busy !== ''}
            className="btn-accent w-full cursor-pointer disabled:opacity-50"
          >
            {busy === 'creating' ? t('creating') : t('createBtn')}
          </button>
          {/* Said before the button is pressed, not after: the id is allocated
              by the server and the slug is derived from this name, and both are
              permanent. */}
          <p className="meta">{t('createNote')}</p>
        </div>

        <input
          type="search"
          className={FIELD_SM}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
        />
        <p className="meta">{t('count', { n: filtered.length })}</p>

        <ul className="flex flex-col gap-1">
          {filtered.map((r) => (
            <li key={r.recipe.id}>
              <button
                type="button"
                onClick={() => open(r)}
                className={`w-full text-left px-3 py-2 rounded-sm cursor-pointer ${
                  draft?.id === r.recipe.id
                    ? 'surface-selected text-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="label text-accent-400 tabular-nums">{r.recipe.id}</span>
                  <span className="label text-ink-faint">
                    {r.recipe.published ? t('statusPublished') : t('statusDraft')}
                  </span>
                </span>
                <span className="block text-body-sm font-semibold truncate">{r.recipe.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex grow basis-[32rem] flex-col gap-6">
        {!draft ? (
          <div className="surface-raised p-8 rounded-md flex flex-col gap-3">
            <h2 className="text-title-2 font-extrabold tracking-[-0.02em] text-ink">
              {t('pickTitle')}
            </h2>
            <p className="text-body leading-relaxed text-ink-muted">{t('pickBody')}</p>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="label text-accent-400 tabular-nums">{draft.id}</span>
                <h2 className="text-title-2 font-extrabold tracking-[-0.02em] text-ink">
                  {draft.name}
                </h2>
                <span className="meta">
                  {t('slugFixed')}: <code>/{draft.slug}</code>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={busy !== '' || !dirty}
                  className="btn-accent cursor-pointer disabled:opacity-50"
                >
                  {busy === 'saving' ? t('saving') : dirty ? t('save') : t('savedState')}
                </button>
                {draft.published ? (
                  <button
                    type="button"
                    onClick={unpublish}
                    disabled={busy !== ''}
                    className="btn-glass cursor-pointer disabled:opacity-50"
                  >
                    {busy === 'unpublishing' ? t('unpublishing') : t('unpublish')}
                  </button>
                ) : null}
              </div>
            </header>

            {status ? (
              <p className={`text-body-sm ${status.kind === 'err' ? 'text-danger' : 'text-ink'}`}>
                {status.msg}
              </p>
            ) : null}

            {issues.length ? (
              <ul className="surface-sunken flex flex-col gap-1 p-4 rounded-sm">
                {issues.map((i) => (
                  <li key={i} className="text-body-sm text-danger">
                    {i}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="label text-ink-muted">{t('name')}</span>
                <input
                  className={FIELD}
                  value={draft.name}
                  onChange={(e) => edit({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label text-ink-muted">{t('tags')}</span>
                <input
                  className={FIELD}
                  value={draft.tags.join(', ')}
                  /* Split and normalised on the way in, so the schema's
                     `^[a-z0-9-]+$` is met by construction rather than by the
                     editor remembering the rule. */
                  onChange={(e) =>
                    edit({
                      ...draft,
                      tags: e.target.value
                        .split(',')
                        .map((s) =>
                          s
                            .trim()
                            .toLowerCase()
                            .replace(/[^a-z0-9-]+/g, '-')
                            .replace(/^-+|-+$/g, ''),
                        )
                        .filter(Boolean),
                    })
                  }
                  placeholder={t('tagsPlaceholder')}
                />
                <span className="meta">{t('tagsHint')}</span>
              </label>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => edit({ ...draft, published: e.target.checked })}
              />
              <span className="text-body text-ink">{t('publishedLabel')}</span>
              <span className="meta">{t('publishedHint')}</span>
            </label>

            <WhiteBalanceFields
              value={draft.whiteBalance}
              onChange={(whiteBalance) => edit({ ...draft, whiteBalance })}
            />

            {/* Keyed on the recipe id so switching recipes remounts it rather
                than showing the previous recipe's photographs while the new
                list loads. */}
            <ImagePanel key={draft.id} recipeId={draft.id} />

            {draft.format === 'pp' ? (
              <PpFields
                value={draft.settings}
                onChange={(settings) => edit({ ...draft, format: 'pp', settings })}
              />
            ) : (
              <ClFields
                value={draft.settings}
                onChange={(settings) => edit({ ...draft, format: 'cl', settings })}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}
