import { SiteHeader } from '@/components/site-header';

/**
 * Skeleton matching the real grid's shape, so the layout does not jump when
 * content arrives. Marked aria-hidden and announced via role=status instead —
 * a screen reader gains nothing from twelve empty boxes.
 */
export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[86rem] flex-1 inset-safe pb-24">
        <div className="py-14">
          <div className="h-3 w-48 rounded bg-white/5" />
          <div className="mt-6 h-12 w-2/3 max-w-xl rounded bg-white/5" />
          <div className="mt-4 h-4 w-full max-w-lg rounded bg-white/5" />
        </div>
        <p role="status" className="sr-only">
          Loading recipes
        </p>
        <ul aria-hidden className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="aspect-[4/5] rounded-[var(--radius-glass)] bg-white/[0.04]" />
          ))}
        </ul>
      </main>
    </>
  );
}
