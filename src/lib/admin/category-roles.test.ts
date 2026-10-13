import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canManageCategory, categoriesFor } from './category-roles';

describe('canManageCategory', () => {
  it('splits the catalogue between DI and PE, and gives super all of it', () => {
    expect(canManageCategory('super', 'audio')).toBe(true);
    expect(canManageCategory('super', 'camera')).toBe(true);
    expect(canManageCategory('di', 'lens')).toBe(true);
    expect(canManageCategory('di', 'audio')).toBe(false);
    expect(canManageCategory('pe', 'audio')).toBe(true);
    expect(canManageCategory('pe', 'camera')).toBe(false);
  });
});

describe('categoriesFor', () => {
  it('offers each role only what a create could save', () => {
    expect(categoriesFor('super')).toEqual(['camera', 'lens', 'accessory', 'audio']);
    expect(categoriesFor('di')).toEqual(['camera', 'lens', 'accessory']);
    expect(categoriesFor('pe')).toEqual(['audio']);
  });

  it('is importable by a client component', () => {
    /* The reason it is not in require-admin.ts. */
    expect(readFileSync('src/lib/admin/category-roles.ts', 'utf8')).not.toMatch(/import ['"]server-only['"]/);
  });
});
