/**
 * Next requires a root layout, but <html> lives in [locale]/layout.tsx where the
 * resolved locale is available for the lang attribute.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
