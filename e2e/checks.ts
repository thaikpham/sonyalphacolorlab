import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/*
 * The four measurements the gates make, one definition each. The specs walk
 * the routes and compare to budgets; e2e/checkers.spec.ts feeds each of these
 * a page built to break it, so a checker that stops seeing (a selector typo,
 * a changed clip rule) fails on its own instead of turning every route green.
 */

/** design-kit's minimum touch target, WCAG 2.5.5. */
export const MIN_TARGET = 44;

/** WCAG 2.1 A/AA, the levels the axe gate holds. */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** One line per serious or critical node axe finds on the page. */
export async function axe(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) => v.nodes.map((n) => `[${v.impact}] ${v.id} — ${v.help} (${n.target.join(' ')})`));
}

/** What overflows on this page: the page itself, and any box that scrolls sideways. */
export async function overflow(page: Page, EXEMPT_SCROLL: string): Promise<string[]> {
  return page.evaluate((EXEMPT_SCROLL) => {
    const W = window.innerWidth;
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > W + 1) {
      let worst: { w: number; d: string } | null = null;
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= W + 1) continue;
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (getComputedStyle(p).overflowX !== 'visible') { clipped = true; break; }
        }
        if (clipped) continue;
        if (!worst || r.right > worst.w) worst = { w: Math.round(r.right), d: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').slice(0, 3).join('.') : '') };
      }
      out.push(`page ${doc.scrollWidth}px > ${W}px` + (worst ? ` (${worst.d} reaches ${worst.w}px)` : ''));
    }
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const s = getComputedStyle(el);
      if (!(s.overflowX === 'auto' || s.overflowX === 'scroll')) continue;
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'PRE' || el.closest('dialog:not([open])')) continue;
      // The design system's own sideways containers (DESIGN.md §Scrollbars).
      if (el.closest(EXEMPT_SCROLL)) continue;
      const label = el.getAttribute('aria-label') || el.getAttribute('role') || '';
      out.push(`scrolls sideways: ${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}${label ? ` [${label}]` : ''} ${el.scrollWidth}px in ${el.clientWidth}px`);
    }
    return out;
  }, EXEMPT_SCROLL);
}

/** Every target under 44px on the page: `path · what (w×h)`. */
export async function small(page: Page, path: string): Promise<string[]> {
  return page.evaluate(({ min, path }) => {
    const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=switch], [role=menuitem], [role=menuitemradio], [role=option], [role=radio]';
    const px = (v: string) => (v.endsWith('px') ? parseFloat(v) : NaN);
    const drawn = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') return null;
      const r = el.getBoundingClientRect();
      // Not drawn (zero size) or clipped to nothing (sr-only).
      if (r.width < 2 || r.height < 2 || cs.clipPath.startsWith('inset(50%') || cs.clip === 'rect(0px, 0px, 0px, 0px)') return null;
      return { cs, r };
    };
    /** The box one can tap: the element, or the hit area its `::before` / `::after` draws around it. */
    const size = (el: HTMLElement, cs: CSSStyleDeclaration, r: DOMRect) => {
      let w = r.width, h = r.height;
      if (cs.position !== 'static') {
        for (const which of ['::before', '::after']) {
          const ps = getComputedStyle(el, which);
          if (ps.content === 'none' || ps.position !== 'absolute' || ps.pointerEvents === 'none') continue;
          const [t, b, l, rt] = [ps.top, ps.bottom, ps.left, ps.right].map(px);
          if (!isNaN(t) && !isNaN(b)) h = Math.max(h, r.height - t - b);
          if (!isNaN(l) && !isNaN(rt)) w = Math.max(w, r.width - l - rt);
        }
      }
      // What an ancestor clips away cannot be tapped.
      // Deviation from design-kit: once an ancestor scrolls on an axis
      // (`auto` / `scroll`), nothing at or above it clips on that axis. What
      // sits inside a scroller is reachable by scrolling, so it is measured at
      // its real size; the kit's maths gave a chip scrolled past the edge of a
      // filter row a negative width (`-232×44`) and counted it as small.
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let scrollsX = false, scrollsY = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ac = getComputedStyle(a);
        if (/auto|scroll/.test(ac.overflowX)) scrollsX = true;
        if (/auto|scroll/.test(ac.overflowY)) scrollsY = true;
        if (scrollsX && scrollsY) break;
        if (!/hidden|clip/.test(ac.overflowX + ac.overflowY)) continue;
        const ar = a.getBoundingClientRect();
        if (!scrollsY && /hidden|clip/.test(ac.overflowY)) h = Math.min(h, 2 * Math.min(cy - ar.top, ar.bottom - cy));
        if (!scrollsX && /hidden|clip/.test(ac.overflowX)) w = Math.min(w, 2 * Math.min(cx - ar.left, ar.right - cx));
      }
      return { w, h };
    };
    // The biggest target for each address, hidden duplicates included (a card's picture).
    const biggest = new Map<string, number>();
    for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const d = drawn(a);
      if (!d) continue;
      const { w, h } = size(a, d.cs, d.r);
      biggest.set(a.href, Math.max(biggest.get(a.href) ?? 0, Math.min(w, h)));
    }
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(SEL)) {
      if (el.closest('[hidden], [inert], [aria-hidden="true"]') || (el as HTMLButtonElement).disabled) continue;
      const d = drawn(el);
      if (!d) continue;
      let { w, h } = size(el, d.cs, d.r);
      // A control inside its label: the label is the target.
      if (el.matches('input')) {
        const lab = el.closest('label') ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
        if (lab) { const lr = lab.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); }
      }
      if (w >= min - 0.5 && h >= min - 0.5) continue;
      if (el instanceof HTMLAnchorElement) {
        // An equivalent of 44px or more to the same address.
        if ((biggest.get(el.href) ?? 0) >= min - 0.5) continue;
        // A link inside a sentence (WCAG's inline exception).
        if (d.cs.display === 'inline') {
          const block = el.parentElement?.closest('p, li, dd, span, div');
          if (block && (block.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 3) continue;
        }
      }
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter((c) => c.startsWith('surface') || c.startsWith('btn-') || c.startsWith('chip') || c === 'label' || c === 'meta').slice(0, 2).join('.') : '';
      // Where it is: the nearest landmark, region or labelled group.
      const at = el.parentElement?.closest('[aria-label], [aria-labelledby], [id], main, nav, header, footer, aside');
      const where = at ? (at.getAttribute('aria-label') || at.id || at.tagName.toLowerCase()).slice(0, 30) : '';
      out.push(`${path} · ${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} "${name}" (${Math.round(w)}×${Math.round(h)})${where ? ' in ' + where : ''}`);
    }
    return out;
  }, { min: MIN_TARGET, path });
}

/** Controls in sight before any scroll, and the parameter rows among them, with names. */
export async function inSight(page: Page) {
  return page.evaluate(() => {
    const seen = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[aria-hidden="true"]')) return false;
      const r = el.getBoundingClientRect();
      let [left, top, right, bottom] = [Math.max(r.left, 0), Math.max(r.top, 0), Math.min(r.right, innerWidth), Math.min(r.bottom, innerHeight)];
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const c = a.getBoundingClientRect();
        [left, top, right, bottom] = [Math.max(left, c.left), Math.max(top, c.top), Math.min(right, c.right), Math.min(bottom, c.bottom)];
      }
      return right - left > 1 && bottom - top > 1;
    };
    const all = [...document.querySelectorAll('a[href],button,[role=button],input,select,summary')].filter(seen);
    const rows = all.filter((el) => el.matches('details.param-row > summary'));
    const controls = all.filter((el) => !rows.includes(el));
    const name = (el: Element) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30);
    return { controls: controls.length, rows: rows.length, names: controls.map(name) };
  });
}
