/**
 * Which product categories each admin role may write.
 *
 * Pure and client-safe on purpose. The routes enforce it — `canManageCategory()`
 * runs against the stored row before any write — and the product editor reads
 * the same function to offer only the categories a save could succeed with.
 * It used to live in `require-admin.ts`, which is `server-only`, so the create
 * form offered all four categories to every role and defaulted to `camera`: a
 * PE admin's first create always answered 403.
 */

export type AdminRole = 'super' | 'di' | 'pe';

export const PRODUCT_CATEGORIES = ['camera', 'lens', 'accessory', 'audio'] as const;
export type ProductCategoryId = (typeof PRODUCT_CATEGORIES)[number];

export function canManageCategory(role: AdminRole, category: string): boolean {
  if (role === 'super') return true;
  if (role === 'di') return category !== 'audio';
  if (role === 'pe') return category === 'audio';
  return false;
}

/** The categories `role` may create, in the order the form lists them. */
export const categoriesFor = (role: AdminRole): ProductCategoryId[] =>
  PRODUCT_CATEGORIES.filter((c) => canManageCategory(role, c));
