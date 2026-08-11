import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ProductSpecs, SonyCamera } from './types';

/**
 * The catalogue is scraped from Sony's own product pages, which vary in how
 * much they publish. That makes it exactly the shape of input the recipe
 * importers already distrust: a row the source does not fully state is skipped
 * and reported, never completed with a plausible value.
 *
 * The failure this guards against is specific and silent. A spec table is read
 * as authoritative — nobody cross-checks "9 aperture blades" against Sony —
 * so one invented row is indistinguishable from thirteen sourced ones. These
 * assertions make the invention structurally impossible to land quietly:
 * every populated field must come with the page it came from, and every gap
 * must be declared rather than left to look like an oversight.
 *
 * They do NOT check that a value is correct. Nothing here can. What they check
 * is that the provenance is intact, which is what makes a wrong value findable.
 */

const products = JSON.parse(
  readFileSync('data/sony-cameras.seed.json', 'utf8'),
) as SonyCamera[];

const withSpecs = products.filter((p) => p.specs);

/** Fields that carry a value, excluding the bookkeeping ones. */
function valueFields(specs: ProductSpecs): [string, unknown][] {
  return Object.entries(specs).filter(
    ([k]) => !['kind', 'specsSource', 'specsMissing', 'keySpecs'].includes(k),
  );
}

describe('sony product catalogue', () => {
  it('has products', () => {
    expect(products.length).toBeGreaterThan(0);
  });

  it('gives every product a category the UI can render', () => {
    for (const p of products) {
      expect(['camera', 'lens', 'accessory'], `${p.name} has category "${p.category}"`).toContain(
        p.category,
      );
    }
  });
});

describe.each(withSpecs.map((p) => [p.name, p] as const))('%s specs', (name, product) => {
  const specs = product.specs as ProductSpecs;

  it('tags the spec block with the product category', () => {
    // A lens rendered through the camera template silently shows thirteen
    // "not published" rows, which reads as a sparse source rather than a bug.
    expect(specs.kind).toBe(product.category);
  });

  it('cites the page the values were read from', () => {
    expect(specs.specsSource, `${name} has no specsSource`).toMatch(/^https:\/\//);
  });

  it('declares every unstated field in specsMissing', () => {
    /* This is the load-bearing one. A null with no entry in specsMissing is
       indistinguishable from a field the extractor forgot, and that ambiguity
       is what lets a later pass "helpfully" fill it in from memory. */
    const nulls = valueFields(specs)
      .filter(([, v]) => v === null)
      .map(([k]) => k)
      .sort();
    expect(nulls, `${name}: nulls not declared in specsMissing`).toEqual(
      [...specs.specsMissing].sort(),
    );
  });

  it('lists nothing in specsMissing that actually has a value', () => {
    for (const key of specs.specsMissing) {
      expect(
        (specs as unknown as Record<string, unknown>)[key],
        `${name}: "${key}" is in specsMissing but holds a value`,
      ).toBeNull();
    }
  });

  it('stores values as non-empty strings', () => {
    for (const [key, value] of valueFields(specs)) {
      if (value === null) continue;
      expect(typeof value, `${name}.${key} is not a string`).toBe('string');
      expect((value as string).trim(), `${name}.${key} is blank`).not.toBe('');
    }
  });

  it('keeps Sony’s Vietnamese prose out of the values', () => {
    /* Values are language-neutral so they need no translation — "Xấp xỉ 679 g"
       would be a user-visible Vietnamese string living outside messages/,
       which is the Rule 3 failure the community error codes just fixed. */
    for (const [key, value] of valueFields(specs)) {
      if (typeof value !== 'string') continue;
      expect(value, `${name}.${key} carries source prose`).not.toMatch(
        /Xấp xỉ|Khoảng |tương đương|loại /i,
      );
    }
  });
});

describe('spec label catalogue', () => {
  const en = JSON.parse(readFileSync('messages/en.json', 'utf8')) as {
    cameras: { specs: Record<string, string> };
  };

  it('defines a label for every field any template renders', () => {
    // Nested below the namespace, so messages.test.ts cannot see these.
    const rendered = readFileSync('src/components/product-detail-modal.tsx', 'utf8');
    const keys = [...rendered.matchAll(/'(\w+)', /g)];
    expect(keys.length).toBeGreaterThan(0);
    for (const field of new Set(withSpecs.flatMap((p) => valueFields(p.specs!).map(([k]) => k)))) {
      expect(en.cameras.specs, `no label for spec field "${field}"`).toHaveProperty(field);
    }
  });
});
