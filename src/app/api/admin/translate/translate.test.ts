import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What the translate route answers — executed, with the model replaced.
 *
 * The only coverage this route had was the source-order assertion in
 * `admin-gate.test.ts` (gate before `translateFeatures`). The contract that
 * matters to the editor is behavioural: exactly one non-empty, single-line
 * bullet back per bullet sent, or a named refusal and nothing changed. The
 * editor joins the reply with `\n` and the save splits it again, so an empty
 * item or one with a line break inside it shifts every bullet after it against
 * its original — the outcome the `mismatch` check exists to prevent.
 */

const model = {
  reply: null as null | { stop_reason?: string; parsed_output: { lines: string[] } | null },
  throws: false,
  calls: 0,
};

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      parse: async () => {
        model.calls += 1;
        if (model.throws) throw new Error('network');
        return model.reply;
      },
    };
  },
}));

vi.mock('@anthropic-ai/sdk/helpers/zod', () => ({ zodOutputFormat: () => ({}) }));

/* A fresh address per test: the rate limiter is the real one, keyed by the
   verified email, and its windows outlive a single test. */
let email = '';
vi.mock('@/lib/auth/admin-gate', () => ({
  adminGate: async () => ({
    ok: true,
    admin: { id: 'u1', email, name: 'Editor', avatarUrl: null, assuranceLevel: 'aal2', role: 'super' },
  }),
}));

const { POST } = await import('./route');
const { translateFeatures } = await import('@/lib/ai/translate-features');

const call = (body: unknown) =>
  POST(new Request('http://local/api/admin/translate', { method: 'POST', body: JSON.stringify(body) }));

const replyWith = (lines: string[]) => {
  model.reply = { stop_reason: 'end_turn', parsed_output: { lines } };
};

let n = 0;
beforeEach(() => {
  email = `editor-${++n}@example.com`;
  model.reply = null;
  model.throws = false;
  model.calls = 0;
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
});

describe('POST /api/admin/translate', () => {
  it('returns one line per input line', async () => {
    replyWith(['Một', 'Hai']);
    const res = await call({ lines: ['One', 'Two'], target: 'vi' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, lines: ['Một', 'Hai'] });
  });

  it.each([
    ['too few', ['Một']],
    ['too many', ['Một', 'Hai', 'Ba']],
    ['an empty item', ['Một', '']],
    ['a whitespace item', ['Một', '   ']],
    ['a line break inside an item', ['Một\nHai', 'Ba']],
  ])('answers mismatch for %s', async (_, lines) => {
    replyWith(lines);
    const res = await call({ lines: ['One', 'Two'], target: 'vi' });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'mismatch' });
  });

  it('answers declined when the model refuses', async () => {
    model.reply = { stop_reason: 'refusal', parsed_output: null };
    const res = await call({ lines: ['One'], target: 'vi' });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'declined' });
  });

  it('answers failed when the call throws', async () => {
    model.throws = true;
    const res = await call({ lines: ['One'], target: 'en' });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'failed' });
  });

  it('answers notConfigured with 503 when there is no key, spending nothing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const res = await call({ lines: ['One'], target: 'vi' });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'notConfigured' });
    expect(model.calls).toBe(0);
  });

  it.each([
    ['a null body', null],
    ['an unknown target', { lines: ['One'], target: 'fr' }],
    ['no lines', { lines: [], target: 'vi' }],
    ['only blank lines', { lines: ['', '   '], target: 'vi' }],
  ])('answers 400 for %s', async (_, body) => {
    const res = await call(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'badRequest' });
    expect(model.calls).toBe(0);
  });

  it('translates only the non-blank lines it was sent, so the count is theirs', async () => {
    /* A blank line in the request used to be dropped inside translateFeatures
       while the route still believed it had sent three. */
    replyWith(['Một', 'Hai']);
    const res = await call({ lines: ['One', '  ', 'Two'], target: 'vi' });
    expect(await res.json()).toEqual({ ok: true, lines: ['Một', 'Hai'] });
  });

  it('rate-limits the sixth call in a minute, with Retry-After', async () => {
    replyWith(['Một']);
    for (let i = 0; i < 5; i++) expect((await call({ lines: ['One'], target: 'vi' })).status).toBe(200);
    const res = await call({ lines: ['One'], target: 'vi' });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await res.json()).error).toBe('rateLimited');
    expect(model.calls).toBe(5);
  });
});

describe('translateFeatures', () => {
  it('trims what it hands back', async () => {
    replyWith(['  Một  ']);
    expect(await translateFeatures(['One'], 'vi')).toEqual({ ok: true, lines: ['Một'] });
  });
});
