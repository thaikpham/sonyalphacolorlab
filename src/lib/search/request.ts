import { z } from 'zod'

import { DEFAULT_LIMIT, MAX_LIMIT, MAX_OFFSET, MAX_QUERY, SEARCH_SCOPES } from './types'

/**
 * The request, validated. Strings from a URL are trimmed and bounded rather
 * than refused where a sensible reading exists — an over-long query is cut to
 * `MAX_QUERY`, the way the predictive route always has — and refused where
 * there is none: an unknown scope or locale is a 400, not a silent default.
 */
export const searchRequestSchema = z.object({
  q: z
    .string()
    .transform((s) => s.trim().slice(0, MAX_QUERY))
    .pipe(z.string().min(1)),
  locale: z.enum(['en', 'vi']).default('en'),
  scope: z.enum(SEARCH_SCOPES).default('all'),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z
    .string()
    .regex(/^\d{1,3}$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(MAX_OFFSET))
    .optional(),
})

export type ParsedSearchRequest = z.output<typeof searchRequestSchema>
