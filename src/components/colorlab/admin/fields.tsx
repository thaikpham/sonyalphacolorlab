'use client';

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

export function Ranged({
  label,
  range,
  value,
  onChange,
  hint,
  signed = false,
}: {
  label: string;
  range: Range;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
  /** The camera displays this parameter with an explicit +/-. */
  signed?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label text-ink-muted">
        {label}
        <span className="ml-2 text-ink-faint tabular-nums">
          {signed && value > 0 ? '+' : ''}
          {value} · {range.min}…{range.max}
          {range.step !== 1 ? ` /${range.step}` : ''}
        </span>
      </span>
      <input
        type="number"
        className={FIELD_SM}
        value={Number.isFinite(value) ? value : ''}
        min={range.min}
        max={range.max}
        step={range.step}
        /* Parsed, not coerced: an empty box is NaN, and writing NaN into the
           draft would send `null` to a `not null` column. The old value stands
           until the box holds a number again. */
        onChange={(e) => {
          const n = Number.parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
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
  labels,
  hint,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  /** Display text per code, where the code is not the readable name. */
  labels?: Readonly<Record<string, string>>;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label text-ink-muted">{label}</span>
      <select className={SELECT} value={value} onChange={(e) => onChange(e.target.value as T)}>
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
