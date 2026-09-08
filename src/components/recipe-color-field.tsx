/**
 * The field a recipe's own colour science produces.
 *
 * Not a placeholder — it is information, which is why it has a component of
 * its own rather than being a grey box. It stands in wherever a photograph is
 * absent, and that is now two different things: a recipe that was never
 * photographed (most of the catalogue), and a photograph that failed to load.
 * The second case is why this moved out of `recipe-card.tsx`: the fallback is
 * decided on the client, so the markup has to be reachable from a client
 * component too.
 *
 * Positioned absolutely, so every caller must give it a `relative` parent.
 */
export function RecipeColorField({ accent }: { accent: string }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background: `
          radial-gradient(120% 90% at 22% 12%, color-mix(in oklch, ${accent} 42%, transparent), transparent 60%),
          radial-gradient(90% 80% at 85% 88%, color-mix(in oklch, ${accent} 22%, transparent), transparent 65%),
          oklch(18% 0.02 265)`,
      }}
    />
  );
}
