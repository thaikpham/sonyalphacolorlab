/**
 * The admin department's one locale.
 *
 * There is no `[locale]` segment above `/admin` to read one from, and the
 * operator reads Vietnamese — see `src/app/admin/layout.tsx`. Named once, here,
 * so the layout and every page's metadata agree; two pages used to pass the
 * string `'vi'` to `getTranslations` themselves, which is how "switchable by
 * one constant" stops being true.
 */
export const ADMIN_LOCALE = 'vi' as const;
