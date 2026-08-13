import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

/**
 * Translates a product's Key Features between English and Vietnamese.
 *
 * Only features. Spec **values** never come through here: they are
 * language-neutral numbers plus the per-field wordlist in
 * `data/spec-values.en.json`, and a model asked to "translate" `F5.6–8` or
 * `78,2 x 164,5 mm` will eventually reformat one of them — swap the decimal
 * comma, round a figure, expand an abbreviation — and produce a spec that is
 * wrong in a way no reader can see. Rule 3 in AGENTS.md draws the line at
 * prose, and this module is the prose side of it.
 *
 * Structured output pins the shape, and the count is checked on return: the
 * model must give back exactly one line per input line, in order, so the admin
 * UI can show them side by side and an editor can correct any single bullet.
 */

const MODEL = 'claude-sonnet-5';

const result = z.object({
  lines: z.array(z.string()).describe('One translated bullet per source bullet, same order'),
});

const SYSTEM = `You translate Sony camera and lens marketing bullets for a photography catalogue.

Rules:
- Return exactly one line per input line, in the same order. Never merge, split, drop or add a line.
- Keep every model name, mount name, technology name and abbreviation exactly as written:
  E-mount, G Master, GM, OSS, SteadyShot, Exmor R, XAVC S-I, S-Cinetone, ED, XD Linear, BIONZ.
- Keep every number, unit and measurement byte-identical: 654g, f/5.6, 100-400mm, 4K 60p, 33MP, 67mm.
  Do not convert units, do not reformat decimals, do not round.
- Translate only the surrounding words.
- Vietnamese: natural photographer's Vietnamese, not literal word-order. Keep it as short as the source.
- Do not add marketing adjectives that are not in the source.`;

export type TranslateError = 'notConfigured' | 'declined' | 'mismatch' | 'failed';

export type TranslateResult =
  | { ok: true; lines: string[] }
  | { ok: false; error: TranslateError };

export async function translateFeatures(
  lines: string[],
  target: 'en' | 'vi',
): Promise<TranslateResult> {
  const source = lines.map((l) => l.trim()).filter(Boolean);
  if (source.length === 0) return { ok: true, lines: [] };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: 'notConfigured' };

  const client = new Anthropic({ apiKey });
  const into = target === 'vi' ? 'Vietnamese' : 'English';

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(result) },
      messages: [
        {
          role: 'user',
          content: `Translate these ${source.length} bullets into ${into}.\n\n${source
            .map((l, i) => `${i + 1}. ${l}`)
            .join('\n')}`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') return { ok: false, error: 'declined' };

    const parsed = response.parsed_output;
    if (!parsed) return { ok: false, error: 'failed' };

    /* A count mismatch is not something to paper over by padding or trimming:
       the bullets would silently shift against their originals and the admin
       would be approving line 4's translation under line 3's text. */
    if (parsed.lines.length !== source.length) return { ok: false, error: 'mismatch' };

    return { ok: true, lines: parsed.lines.map((l) => l.trim()) };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
