import { describe, expect, it } from 'vitest';
import { SPEC_FIELD_META } from './spec-meta';

/**
 * The unit chip beside a number field is a label, not part of the value: the
 * editor stores the string as typed, and every catalogue value carries its unit
 * (`679 g`, `67 mm`). A placeholder of bare `658` taught editors to save
 * `Weight 658`, which the public table then printed with no unit.
 */
describe('spec field placeholders', () => {
  const withUnit = Object.values(SPEC_FIELD_META).filter((m) => m.unit);

  it('has fields with a unit to check', () => {
    expect(withUnit.length).toBeGreaterThan(0);
  });

  it.each(withUnit.map((m) => [m.key, m] as const))('shows %s in the stored form, unit included', (_key, meta) => {
    expect(meta.placeholder).toMatch(new RegExp(`\\d ${meta.unit}$`));
  });
});
