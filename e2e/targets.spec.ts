import { expect, test, type Page } from '@playwright/test';
import { report } from './budgets.ts';
import { ROUTES, ready, resolve } from './setup.ts';

/*
 * Touch targets on a phone (design-kit's "Mobile" gate): on every screen
 * (setup.ts ROUTES), at 390px with a touch screen, everything one taps is at
 * least 44 × 44px, counting the hit area a target draws around itself
 * (`::before` / `::after` with a negative inset). Exempt, as WCAG 2.5.5 has
 * it: a link inside a sentence; a link with an equivalent of 44px or more to
 * the same address (a card's title beside its picture); a control the browser
 * draws whose label is the target (a checkbox in its label). A route may carry
 * a recorded count in e2e/budgets.json, which only goes down.
 */

const MIN = 44;

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/** Every target under 44px on the page: `path · what (w×h)`. */
async function small(page: Page, path: string): Promise<string[]> {
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
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ac = getComputedStyle(a);
        if (!/hidden|clip/.test(ac.overflowX + ac.overflowY)) continue;
        const ar = a.getBoundingClientRect();
        if (/hidden|clip/.test(ac.overflowY)) h = Math.min(h, 2 * Math.min(cy - ar.top, ar.bottom - cy));
        if (/hidden|clip/.test(ac.overflowX)) w = Math.min(w, 2 * Math.min(cx - ar.left, ar.right - cx));
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
  }, { min: MIN, path });
}

for (const [role, routes] of Object.entries(ROUTES) as [keyof typeof ROUTES, string[]][]) {
  test(`${role}: every target on a phone is at least 44px`, async ({ page }) => {
    test.setTimeout(600_000);
    const over: string[] = [];
    for (const route of routes) {
      const path = await resolve(page, route);
      if (!path) { console.log(`skip ${route}: no instance in the sitemap`); continue; }
      await page.goto(path);
      await ready(page);
      const found = await small(page, path);
      if (!report('targets', path, found)) over.push(`${path}: ${found.length} over budget`);
    }
    expect(over, over.join('\n')).toEqual([]);
  });
}
