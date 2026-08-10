import { notoSans, notoSansMono } from './fonts';
import './globals.css';

/**
 * Root layout required by Next.js 16 (Turbopack).
 * Renders top-level <html> and <body> elements for all routes including _not-found.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${notoSans.variable} ${notoSansMono.variable} h-full antialiased`}>
      <body className="app-shell font-sans min-h-screen-dynamic flex flex-col">
        {children}
      </body>
    </html>
  );
}
