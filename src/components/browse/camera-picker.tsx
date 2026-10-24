'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { CHIP_IDLE, CHIP_SELECTED } from '@/components/chip-styles';
import { ProductPhoto } from '@/components/product-photo';
import type { CameraOption } from '@/lib/cameras/my-camera';
import { chooseMyCamera } from '@/lib/cameras/my-camera-action';

/** The two generic ids, restated as literals so this file pulls no evidence into the bundle. */
const OLDER = 'older-creative-style';
const UNKNOWN = 'unknown';

/**
 * "My camera": one chip that opens the list of the catalogue's cameras and the
 * two generic choices. Choosing submits `chooseMyCamera`, which writes the
 * cookie and re-renders this page — the URL never changes (ADR 0006).
 *
 * A dropdown from `sm` up, a bottom sheet below it. Both are the same element:
 * the positioning (`fixed` on a phone, `absolute` from `sm`) is on a plain
 * wrapper with the opaque backing, and `.surface-raised` with
 * `.animate-fade-in` is on the panel inside it — so nothing `fixed` sits
 * inside the fading panel, and the surface class decides nothing about
 * `position`. It is rendered outside the chip rows' `.filter-scroll`, whose
 * `overflow-x` would clip an absolute dropdown.
 */
export function CameraPicker({
  options,
  current,
}: {
  options: readonly CameraOption[];
  /** The recognised choice and its name (`null` name: the generic older camera), or no camera. */
  current: { readonly choice: string; readonly name: string | null } | null;
}) {
  const t = useTranslations('myCamera');
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    /* The `sm` dropdown's dismissal: outside the panel and the chip. Not the
       phone's backdrop — closing on its pointerdown unmounts it before the
       tap's click, which then lands on whatever is underneath. The backdrop
       closes the sheet on its own click instead, and consumes it. */
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (target === backdropRef.current) return;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selected = current?.choice ?? UNKNOWN;
  const label = current ? (current.name ?? t('older')) : t('choose');
  const rows: readonly Row[] = [
    { id: OLDER, name: t('older'), meta: null, imageUrl: null },
    { id: UNKNOWN, name: t('unknown'), meta: null, imageUrl: null },
    ...options.map((o) => ({ id: o.id, name: o.name, meta: o.id, imageUrl: o.imageUrl })),
  ];

  return (
    <div
      className="relative"
      /* Tabbing out of the open list closes it, so focus never sits on a link
         the panel or the backdrop covers. Only a move to a real element:
         Safari does not focus a clicked button, so a click leaves
         `relatedTarget` null — pointerdown handles the mouse. */
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && !e.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={current ? CHIP_SELECTED : CHIP_IDLE}
      >
        <span className="max-w-[16rem] truncate">{label}</span>
        <span aria-hidden className={current ? 'text-accent-200' : 'text-ink-faint'}>
          ▾
        </span>
      </button>

      {open ? (
        <>
          {/* The phone's backdrop. A sibling of the sheet, not its parent. */}
          <div
            ref={backdropRef}
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-void/60 sm:hidden"
          />
          <div
            ref={panelRef}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col overflow-hidden rounded-t-xl bg-void/95 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:max-h-[min(32rem,70dvh)] sm:w-[22rem] sm:rounded-lg"
          >
            <form
              id={panelId}
              aria-label={t('label')}
              action={async (formData) => {
                await chooseMyCamera(formData);
                setOpen(false);
                /* The pressed row goes with the panel; as Escape does, put focus back on the chip. */
                triggerRef.current?.focus();
              }}
              className="surface-raised animate-fade-in flex min-h-0 flex-1 flex-col"
            >
              <CameraOptions rows={rows} selected={selected} />
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}

export type Row = { readonly id: string; readonly name: string; readonly meta: string | null; readonly imageUrl: string | null };

/**
 * A child of the form, so `useFormStatus` sees the submission. Exported for
 * its render test. The selected row sits on the accent-tinted
 * `.surface-selected` field, so its name is pure white and its model code
 * accent 200 (CLAUDE.md rule 5) — never the faint ink of an idle row.
 */
export function CameraOptions({ rows, selected }: { rows: readonly Row[]; selected: string }) {
  const { pending } = useFormStatus();

  return (
    <ul aria-busy={pending} className={`scroll-area flex min-h-0 flex-1 flex-col gap-1 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${pending ? 'opacity-60' : ''}`}>
      {rows.map((row) => {
        const isSelected = row.id === selected;
        return (
          <li key={row.id}>
            <button
              type="submit"
              name="camera"
              value={row.id}
              disabled={pending}
              aria-current={isSelected ? 'true' : undefined}
              className={`flex w-full min-h-[var(--layout-touch-target)] items-center gap-3 rounded-sm px-3 py-2 text-left cursor-pointer ${
                isSelected ? 'surface-selected' : 'hover:bg-white/[0.06]'
              }`}
            >
              {/* A white plate, as in the compare picker: the product shots are
                  cut out on white. Empty alt — the name beside it labels the row.
                  A generic choice keeps the slot, as film, so the names align. */}
              {row.imageUrl ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-white p-1">
                  <ProductPhoto src={row.imageUrl} alt="" size={40} className="max-h-full object-contain" />
                </span>
              ) : (
                <span aria-hidden className="h-10 w-10 shrink-0 rounded-sm bg-white/[0.08]" />
              )}
              <span className="flex min-w-0 flex-col">
                <span className={`text-body-sm font-semibold text-pretty ${isSelected ? 'text-white' : 'text-ink'}`}>
                  {row.name}
                </span>
                {row.meta ? (
                  <span className={`meta tabular-nums truncate${isSelected ? ' text-accent-200' : ''}`}>{row.meta}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
