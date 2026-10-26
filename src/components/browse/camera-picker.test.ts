import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * The "My camera" picker (ADR 0006).
 *
 * This suite has no DOM, so nothing here taps or tabs. The rows are rendered;
 * the dismissal rules exist only as event handlers, so each is asserted by
 * its shape, sliced out of the source the way `site-header.test.ts` does it.
 * Each slice pins the one line that decides the behaviour its test names.
 */

/* A Server Function module: `next/headers` does not resolve outside Next. */
vi.mock('@/lib/cameras/my-camera-action', () => ({ chooseMyCamera: async () => {} }));

const { CameraOptions } = await import('./camera-picker');

const source = readFileSync('src/components/browse/camera-picker.tsx', 'utf8');
/** From `from` to the next `to` after it. */
const slice = (from: string, to: string) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  expect(start, `${from} is missing`).toBeGreaterThan(-1);
  expect(end, `${to} is missing after ${from}`).toBeGreaterThan(start);
  return source.slice(start, end + to.length);
};

describe('the rows', () => {
  const rows = [
    { id: 'older-creative-style', name: 'Older camera', meta: null, imageUrl: null },
    { id: 'TEST-1', name: 'Test One', meta: 'TEST-1', imageUrl: null },
    { id: 'TEST-2', name: 'Test Two', meta: 'TEST-2', imageUrl: null },
  ];
  const html = renderToStaticMarkup(createElement(CameraOptions, { rows, selected: 'TEST-1' }));
  const row = (id: string) => {
    const m = new RegExp(`<button[^>]*value="${id}"[^>]*>[\\s\\S]*?</button>`).exec(html);
    expect(m, id).not.toBeNull();
    return m![0];
  };

  /* CLAUDE.md rule 5: on a tinted accent field the text is pure white and
     its label a 200–300 step of the ramp — `.meta`'s faint ink is dark type
     on a dark field there. */
  it('the selected row is white on the tint, its model code accent 200', () => {
    const selected = row('TEST-1');
    expect(selected).toMatch(/^<button[^>]*class="[^"]*\bsurface-selected\b/);
    expect(selected).toMatch(/<span class="[^"]*\btext-white\b[^"]*">Test One<\/span>/);
    expect(selected).toMatch(/<span class="meta\b[^"]*\btext-accent-200\b[^"]*">TEST-1<\/span>/);
  });

  it('an idle row stays on the ink ramp', () => {
    const idle = row('TEST-2');
    expect(idle).not.toContain('surface-selected');
    expect(idle).not.toMatch(/text-white|text-accent/);
    expect(idle).toMatch(/<span class="[^"]*\btext-ink\b[^"]*">Test Two<\/span>/);
    expect(idle).toMatch(/<span class="meta tabular-nums truncate">TEST-2<\/span>/);
  });
});

describe('closing', () => {
  /* On a phone, closing on the backdrop's pointerdown unmounted it before
     the tap's click, which then pressed whatever was underneath. */
  it('the document pointerdown leaves the phone backdrop to its own click', () => {
    const handler = slice('const onPointerDown', '};');
    const skip = handler.indexOf('if (target === backdropRef.current) return;');
    expect(skip).toBeGreaterThan(-1);
    expect(skip).toBeLessThan(handler.indexOf('setOpen(false)'));

    const backdrop = slice('ref={backdropRef}', '/>');
    expect(backdrop).toContain('onClick={() => setOpen(false)}');
    /* The `sm` dropdown has no backdrop; pointerdown alone dismisses it. */
    expect(backdrop).toContain('sm:hidden');
  });

  it('choosing a camera puts focus back on the chip, as Escape does', () => {
    const action = slice('action={async (formData) => {', '}}');
    const close = action.indexOf('setOpen(false);');
    expect(close).toBeGreaterThan(action.indexOf('await chooseMyCamera(formData);'));
    expect(action.indexOf('triggerRef.current?.focus();')).toBeGreaterThan(close);

    const escape = slice('const onKeyDown', '};');
    expect(escape).toContain('triggerRef.current?.focus();');
  });

  /* Tabbing past the last row moved focus onto links the open panel or the
     backdrop covers. A null `relatedTarget` is not a move — Safari does not
     focus a clicked button — so it must not close the panel. */
  it('focus leaving the picker closes it; focus going nowhere does not', () => {
    const root = slice('<div\n      className="relative"', '>\n      <button');
    const blur = slice('onBlur={(e) => {', '}}');
    expect(root).toContain(blur);
    expect(blur).toContain('const next = e.relatedTarget as Node | null;');
    expect(blur).toContain('if (next && !e.currentTarget.contains(next)) setOpen(false);');
  });
});
