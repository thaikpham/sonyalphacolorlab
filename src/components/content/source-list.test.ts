import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  getLocale: async () => 'en',
}));

const { formatIsoDay } = await import('./source-list');

/**
 * A source's checked date is a calendar day, and the day must not move.
 *
 * `2026-10-05` parsed as a moment is midnight UTC, which is still the 4th
 * anywhere west of Greenwich. The formatter pins the zone to UTC so every
 * reader sees the day the editor typed; without that, readers in the Americas
 * would be told a page was checked a day earlier than it was.
 */

const TZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = TZ;
});

describe('formatIsoDay', () => {
  it('keeps the calendar day west of UTC', () => {
    process.env.TZ = 'America/Los_Angeles';
    expect(formatIsoDay('2026-10-05', 'en')).toBe('Oct 5, 2026');
  });

  it('keeps the calendar day east of UTC', () => {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    expect(formatIsoDay('2026-10-05', 'en')).toBe('Oct 5, 2026');
  });

  it('returns what it cannot read unchanged, rather than "Invalid Date"', () => {
    expect(formatIsoDay('not-a-date', 'vi')).toBe('not-a-date');
  });
});
