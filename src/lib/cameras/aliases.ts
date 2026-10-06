/**
 * Names a reader types for a product, derived from the catalogue itself.
 *
 * The old search kept a hand-written table (`a7cii: ['ilce7cm2', …]`) of a
 * dozen bodies, typed from memory. That table is exactly what Rule 1 forbids
 * for camera values, and it silently knew nothing about the rest of the
 * catalogue. Every alias here is computed from two facts the catalogue already
 * publishes — the SKU's model code and the marketing name — so a body the
 * catalogue holds is findable by every spelling below, and a body it does not
 * hold has no alias at all rather than a guessed one.
 *
 * All outputs are normalised (lower-case ASCII letters and digits only), the
 * same form `normalizeSearchTerm` produces for a query.
 */

const ROMAN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bvii\b/g, '7'],
  [/\bvi\b/g, '6'],
  [/\biv\b/g, '4'],
  [/\bv\b/g, '5'],
  [/\biii\b/g, '3'],
  [/\bii\b/g, '2'],
]

const squash = (s: string) =>
  s
    /* Sony prints the Alpha line with a Greek α: `α7 IV` is `a7 IV`. */
    .replace(/α/gi, 'a')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/**
 * The model code a SKU starts with: `ILCE-7CM2/SQAP2` → `ILCE-7CM2`,
 * `ILME-FX6V//CAP2` → `ILME-FX6V`, `DSC-RX1RM3  AP2` → `DSC-RX1RM3`. Empty when
 * the source published no SKU (the audio sheets), never a guess.
 */
export function modelCode(sku: string): string {
  return sku.split('/')[0].trim().split(/\s+/)[0] ?? ''
}

/** The model code with its family prefix dropped: `ILCE-7CM2` → `7CM2`. */
function bareModel(code: string): string {
  const i = code.indexOf('-')
  return i > 0 ? code.slice(i + 1) : code
}

/**
 * Every normalised spelling of one product.
 *
 * For `{ sku: 'ILCE-7CM2/SQAP2', name: '7C II' }`:
 * `ilce7cm2`, `7cm2`, `a7cm2`, `7cii`, `a7cii`, `alpha7cii`, `7c2`, `a7c2`,
 * `alpha7c2`.
 *
 * The `a`/`alpha` prefixes are added only to an interchangeable-lens body name
 * that starts with a digit — `7 IV`, `6700`, `1 II` — which is how Sony styles
 * the Alpha line (`α7 IV`). `ZV-E10` and `FX3` are already their own names.
 */
export function productAliases(product: { sku: string; name: string }): readonly string[] {
  const out = new Set<string>()
  const code = modelCode(product.sku)
  if (code) {
    out.add(squash(code))
    /* The family prefix is dropped only where readers drop it: an Alpha body
       is "7CM2", a cinema body "FX6V", a compact "RX100M7". A ZV body's prefix
       is its name — `ZV-1` without it is "1", which is the a1. */
    if (/^(ILCE|ILME|DSC)-/i.test(code)) {
      const bare = bareModel(code)
      out.add(squash(bare))
      if (/^ILCE-/i.test(code) && /^\d/.test(bare)) out.add(`a${squash(bare)}`)
    }
  }

  const name = product.name.trim()
  if (name) {
    const lower = name.toLowerCase()
    let digits = lower
    for (const [re, n] of ROMAN) digits = digits.replace(re, n)
    for (const variant of new Set([lower, digits])) {
      const v = squash(variant)
      if (!v) continue
      out.add(v)
      if (/^\d/.test(v) && /^ILCE-/i.test(code)) {
        out.add(`a${v}`)
        out.add(`alpha${v}`)
      }
    }
  }

  /* One character matches too much to be a name: the a1 is still `a1`,
     `alpha1` and `ilce1`, but not a bare `1`. */
  return [...out].filter((a) => a.length >= 2)
}

/**
 * The one catalogue product a free-text camera name means — an EXIF `Model`
 * tag, a marketing name, a model code — or `null` when no product, or more
 * than one, answers to it.
 *
 * Matching is on the same normalised aliases search uses, so `ILCE-7M4`,
 * `α7 IV` and `a7iv` all resolve to the a7 IV, and nothing is resolved by a
 * table typed from memory. What a given body actually writes into its EXIF is
 * not asserted here: photo discovery (brief PR6) must prove that against real
 * files before it relies on any spelling.
 */
export function resolveCamera<T extends { sku: string; name: string }>(text: string, products: readonly T[]): T | null {
  const wanted = squash(text)
  if (wanted.length < 2) return null
  const hits = products.filter((p) => productAliases(p).includes(wanted))
  return hits.length === 1 ? hits[0] : null
}
