/**
 * Tested by scripts/design-checklist.test.ts. The design checklist of a pull request
 * (.github/pull_request_template.md, section "## Thiết kế"): every box ticked, or the
 * first one, "Không đổi giao diện". Run by .github/workflows/design-checklist.yml
 * with the PR's description in PR_BODY.
 */

import { pathToFileURL } from 'node:url';

const HEAD = /^##\s+(?:Thiết kế|Design)\s*$/m;
const NONE = /không đổi giao diện|no (?:ui|visual) change/i;

/** What is wrong with the description, or an empty list when the checklist passes. */
export function problems(body) {
  const text = String(body ?? '').replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const at = text.search(HEAD);
  if (at < 0) return ['The description has no "## Thiết kế" checklist: copy it from .github/pull_request_template.md.'];
  const rest = text.slice(at).split('\n').slice(1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  const boxes = (end < 0 ? rest : rest.slice(0, end))
    .map((l) => l.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/))
    .filter(Boolean)
    .map((m) => ({ done: m[1] !== ' ', text: m[2].trim() }));
  if (!boxes.length) return ['The "## Thiết kế" section has no boxes: copy it from .github/pull_request_template.md.'];
  // The shortcut ("Không đổi giao diện" ticked) only excuses the rest when it is used
  // alone: ticked with every other box still untouched. Once any other box has also
  // been ticked, the author is going for full completion and the remaining unticked
  // ones are reported, same as if the shortcut box did not exist.
  const none = boxes.filter((b) => NONE.test(b.text));
  const others = boxes.filter((b) => !NONE.test(b.text));
  if (none.some((b) => b.done) && !others.some((b) => b.done)) return [];
  return others.filter((b) => !b.done).map((b) => `Not ticked: ${b.text}`);
}

// import.meta.url === `file://${process.argv[1]}` breaks on a path containing a space
// (this repo's does: "ColorLab 2.0") — file:// URL-encodes the space, the template
// literal does not, so the two never match and the script silently never runs as a CLI.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = problems(process.env.PR_BODY);
  for (const p of out) console.log(`::error::${p}`);
  if (out.length) process.exit(1);
  console.log('Design checklist: every box ticked.');
}
