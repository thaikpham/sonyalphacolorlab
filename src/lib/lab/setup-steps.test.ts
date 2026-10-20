import { describe, expect, it } from 'vitest';

import { recapRows, setupSteps } from './setup-steps';

/**
 * The recap table repeats every setting the guide asks for, so its value
 * column has to agree with the path printed beside it. The back-button-AF
 * tip once filled both of its rows with "AF-ON", and the row that turns
 * half-press focus off read "AF-ON" next to a path ending in "→ Off".
 */

// The key stands in for the copy; the paths and values here are camera text.
const copy = (key: string) => key;

describe('recapRows', () => {
  it.each(['old', 'new'] as const)('gives each tip row the value its own path ends on (%s menus)', (version) => {
    const rows = recapRows(setupSteps(version, copy));
    const assign = rows.find((r) => r.label === 'setupSteps.focusArea.tipAssign');
    const halfPress = rows.find((r) => r.label === 'setupSteps.focusArea.tipHalfPress');
    expect(assign?.value).toBe('AF ON');
    expect(halfPress?.value).toBe('Off');
    for (const row of [assign, halfPress]) expect(row?.path.endsWith(`→ ${row?.value}`)).toBe(true);
  });
});
