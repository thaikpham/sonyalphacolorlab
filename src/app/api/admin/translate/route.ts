import { NextResponse } from 'next/server';
import { requireAdmin, NOT_ADMIN } from '@/lib/auth/require-admin';
import { translateFeatures } from '@/lib/ai/translate-features';
import { checkRateLimit } from '@/lib/ai/rate-limit';

/**
 * Translates a product's Key Features into the other locale.
 *
 * It returns the lines; it does not save them. That separation is deliberate —
 * a machine translation lands in the editor's textarea for them to read and fix
 * before it becomes the copy a reader sees. Auto-saving would put unreviewed
 * output on 94 public pages, and the model is good at this but not right about
 * every product name it has never seen.
 *
 * Admin-gated and rate-limited even though admins are trusted: this spends
 * money per call, and a stuck retry loop in a browser tab is the ordinary way
 * that bill arrives.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json(NOT_ADMIN, { status: 403 });

  /* Namespaced by route so a translation burst cannot exhaust the same budget
     the reader-facing "Tweak with AI" endpoint draws on. */
  const limit = checkRateLimit(`admin-translate:${admin.email}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'rateLimited', retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let body: { lines?: unknown; target?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  const lines = Array.isArray(body.lines)
    ? body.lines.filter((l): l is string => typeof l === 'string').slice(0, 40)
    : [];
  const target = body.target === 'en' ? 'en' : body.target === 'vi' ? 'vi' : null;

  if (lines.length === 0 || !target) {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  const result = await translateFeatures(lines, target);
  if (!result.ok) {
    const status = result.error === 'notConfigured' ? 503 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, lines: result.lines });
}
