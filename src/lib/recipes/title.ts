/**
 * "SCL-PP-001: Mojave Sun" → "Mojave Sun".
 *
 * The stored name carries the catalogue code because the code is what the
 * legacy site, the search index and the admin editor key on. A reader browsing
 * the grid does not (Q4): the card shows the name alone, and the recipe page
 * keeps the code in its own chip beside the heading.
 */
export const recipeTitle = (name: string): string =>
  name.includes(': ') ? name.split(': ').slice(1).join(': ') : name;
