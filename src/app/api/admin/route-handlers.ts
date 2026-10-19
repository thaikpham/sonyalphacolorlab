/**
 * A route file split into its exported handlers, for the source assertions in
 * `admin-gate.test.ts` and `content-write-boundaries.test.ts`.
 *
 * Every ordering rule those files pin — the gate before the body, the freeze
 * before the client, the 502 before the invalidation — is a rule about ONE
 * handler. Measured across the file, the first handler answered for all of
 * them: GET comes first in every route that has one, so its gate and its 502
 * satisfied a PATCH or DELETE that parsed its body ungated, skipped the freeze,
 * or invalidated before its own failure path, and the suite stayed green.
 *
 * Each slice runs from `export async function VERB(` to the closing brace at
 * column zero, so a module-level helper declared between two handlers belongs
 * to neither. Not a route module: Next only routes a file named `route.ts`.
 */

export type Verb = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface Handler {
  verb: Verb;
  body: string;
}

export const MUTATING_VERBS: ReadonlySet<Verb> = new Set(['POST', 'PATCH', 'DELETE']);

export function routeHandlers(source: string): Handler[] {
  return [...source.matchAll(/^export async function (GET|POST|PATCH|DELETE)\(/gm)].map((m) => {
    const end = source.indexOf('\n}', m.index);
    return {
      verb: m[1] as Verb,
      body: source.slice(m.index, end === -1 ? undefined : end + 2),
    };
  });
}
