'use client';

import { useState } from 'react';
import { FIELD_SM, SELECT } from '@/components/admin-ui/controls';
import type { Range } from '@/lib/camera/constants';

/**
 * The two controls every recipe field is made of.
 *
 * Both take their bounds from `constants.ts` and nothing else — AGENTS.md
 * Rule 1, enforced by shape rather than by discipline: `Ranged` cannot be
 * rendered without a `Range`, and there is no prop for a min or a max that
 * somebody could type from memory. When Sony changes a range upstream it
 * changes in `constants.ts`, and the form, the Zod schema and the table's
 * CHECK constraint all follow from the same edit.
 *
 * `step` is passed through to the input so the browser's own spinner lands on
 * legal values — the 0.25 white-balance grid and the 0.5 knee point are the
 * two that a whole-number spinner would quietly violate.
 */

/**
 * What a number box holds, or null when it holds no number yet.
 *
 * Parsed, not coerced: `Number('')` is 0, and an empty box or a lone `-` is a
 * value being typed, not a value. Writing NaN into the draft would send `null`
 * to a `not null` column.
 */
export function parseRangedInput(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** The object without one key — how an optional field is cleared. */
export function omitKey<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const { [key]: _drop, ...rest } = obj;
  return rest;
}

export function Ranged({
  label,
  range,
  value,
  onChange,
  onClear,
  hint,
  signed = false,
}: {
  label: string;
  range: Range;
  /** Undefined only for an optional field, with `onClear`. */
  value: number | undefined;
  onChange: (n: number) => void;
  /** The field is optional, and an emptied box removes it. */
  onClear?: () => void;
  hint?: string;
  /** The camera displays this parameter with an explicit +/-. */
  signed?: boolean;
}) {
  /* The box as typed, while it is being edited. Controlled by the number
     alone, a box that did not hold one yet — a lone `-`, or emptied to retype
     — had the old value written back by React: "-7" typed over 0 came out
     as 7, and a cleared box snapped back. */
  const [text, setText] = useState<string | null>(null);
  const shown = value !== undefined && Number.isFinite(value) ? String(value) : '';
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label text-ink-muted">
        {label}
        <span className="ml-2 text-ink-faint tabular-nums">
          {value !== undefined ? `${signed && value > 0 ? '+' : ''}${value} · ` : ''}
          {range.min}…{range.max}
          {range.step !== 1 ? ` /${range.step}` : ''}
        </span>
      </span>
      <input
        type="number"
        className={FIELD_SM}
        value={text ?? shown}
        min={range.min}
        max={range.max}
        step={range.step}
        /* The old value stands until the box holds a number again — except in
           an optional field, where a box the editor emptied (not one holding a
           half-typed `-`, which also reads as '') means "not stated". */
        onChange={(e) => {
          setText(e.target.value);
          const n = parseRangedInput(e.target.value);
          if (n !== null) onChange(n);
          else if (onClear && e.target.value === '' && !e.target.validity.badInput) onClear();
        }}
        onBlur={() => setText(null)}
      />
      {hint ? <span className="meta">{hint}</span> : null}
    </label>
  );
}

export function EnumSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  onClear,
  unsetLabel,
  labels,
  hint,
}: {
  label: string;
  options: readonly T[];
  /** Undefined only for an optional field, with `onClear`. */
  value: T | undefined;
  onChange: (v: T) => void;
  /** The field is optional: an empty first option removes it. */
  onClear?: () => void;
  /** What the empty option reads. */
  unsetLabel?: string;
  /** Display text per code, where the code is not the readable name. */
  labels?: Readonly<Record<string, string>>;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label text-ink-muted">{label}</span>
      <select
        className={SELECT}
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value === '') onClear?.();
          else onChange(e.target.value as T);
        }}
      >
        {onClear ? <option value="">{unsetLabel}</option> : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
      {hint ? <span className="meta">{hint}</span> : null}
    </label>
  );
}

/** A titled group of fields. Purely visual — the grouping is the camera's. */
export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-body-sm font-extrabold tracking-[-0.01em] text-ink">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
