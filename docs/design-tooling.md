# Design tooling — what is installed, and what it is allowed to decide

Installed 2026-09-21 from
<https://cuongmeai.com/tai-lieu/5-cong-cu-design-claude-code>.

Five tools. The important part of this document is not the install list — it is
the last section, because four of the five arrive with opinions that contradict
`DESIGN.md`, and `DESIGN.md` wins.

---

## What is installed

| # | Tool | Where | Invoke |
|---|---|---|---|
| 1 | taste-skill (9 variants) | `.claude/skills/` | see table below |
| 2 | Web Design Guidelines | `.claude/skills/web-design-guidelines/` | `/web-design-guidelines <glob>` |
| 3 | awesome-design-md (74 brands) | `docs/design-md/` | read the file, no skill |
| 4 | Image to Code | `.claude/skills/image-to-code/` | `/image-to-code` |
| 5 | Playwright CLI | global npm, skill in `.claude/skills/playwright-cli/` | `playwright-cli …` |

### The taste-skill variants

Installed under the `name:` from each skill's own frontmatter, which is what
the invocation matches — not the folder name in the upstream repository.

| Skill | Upstream folder | What it is for |
|---|---|---|
| `design-taste-frontend` | `taste-skill` | landing pages, portfolios, redesigns |
| `redesign-existing-projects` | `redesign-skill` | audit-first upgrade of an existing app |
| `minimalist-ui` | `minimalist-skill` | warm monochrome editorial |
| `high-end-visual-design` | `soft-skill` | agency-tier depth and motion |
| `industrial-brutalist-ui` | `brutalist-skill` | Swiss/terminal, extreme scale contrast |
| `stitch-design-taste` | `stitch-skill` | generates a `DESIGN.md` for Google Stitch |
| `image-to-code` | `image-to-code-skill` | generate reference images, then build to them |
| `brandkit` | `brandkit` | brand-identity image boards |
| `full-output-enforcement` | `output-skill` | bans placeholder/elided code in output |

`npx skills add` was not used. It executes an npm package that fetches and runs
code from a third-party repository; the `SKILL.md` files were downloaded
directly and read before being written into the repository. If you re-install
or update, do the same.

### Playwright CLI

```bash
npm install -g @playwright/cli@latest
```

`playwright-cli install --skills` writes into the agent's own configuration
rather than the repository, so the skill was copied out of the installed
package into `.claude/skills/playwright-cli/` by hand.

What it is actually for here — checking a change at both ends of the range,
without reading a page's source:

```bash
playwright-cli open http://localhost:3000/vi/colorlab
playwright-cli resize 1440 900 && playwright-cli screenshot --filename=desktop.png
playwright-cli resize 390 844  && playwright-cli screenshot --filename=phone.png
playwright-cli console
```

The 390px pass is not optional. Three of the defects this tooling found on the
day it was installed — the header losing its wordmark, the language control
becoming the loudest object on the page, and the display title breaking to
three lines — were visible only at phone width.

### awesome-design-md

74 brands under `docs/design-md/<brand>/DESIGN.md`, each with light and dark
preview files.

**The upstream instruction is to copy a brand's `DESIGN.md` to the project
root. Do not do that here.** `/DESIGN.md` is this ecosystem's own system: it
was written after the feedback that the site looked AI-generated, every rule in
it is the fix for something that was really in this repository, and eight grep
commands at the bottom of it fail the build on a violation. Dropping Linear's
file on top of it would replace a system that is enforced with one that is not.

Read a brand file as a *reference* — for typographic rhythm, density, spacing —
then translate what is worth having into the tokens that already exist.

---

## What these tools are allowed to decide

`DESIGN.md` is the law. It is not a starting point to be improved on by a
skill, and no skill in this directory may amend it.

**Use freely.** `web-design-guidelines` and `redesign-existing-projects` are
aesthetically neutral — they check accessibility, focus order, keyboard
support, empty states, content handling, and they audit before they change
anything. Both are safe to run against any file here.

**Use as reference only.** `minimalist-ui`, `high-end-visual-design`,
`industrial-brutalist-ui`, `design-taste-frontend`, `stitch-design-taste`. Each
carries a complete aesthetic, and each contradicts this one at the root:

- `minimalist-ui` specifies a *warm monochrome* palette, flat surfaces, no
  gradients and no heavy shadows. This system is blue-black, and its depth is
  translucency plus blur plus shadow plus a specular highlight — §Surfaces.
- `high-end-visual-design` specifies premium display typefaces and cinematic
  motion. This system is one family, Noto Sans, self-hosted, four weights, no
  second face anywhere — §Type — and has exactly one animation, §Motion.
- `industrial-brutalist-ui` specifies rigid grids, hard corners and analog
  degradation. Radii here are 12 / 14 / 26 / 32 and `rounded-none` is the
  scanner's `hardCorner` rule (`src/design/floor.ts`).
- `design-taste-frontend` says of itself: *not dashboards, not data tables, not
  multi-step product UI.* Most of this ecosystem is a spec table.

Running one of those against a component and applying its output verbatim will
break `src/design/floor.test.ts`, which is the audit as a test, and it will
undo the rebuild that `DESIGN.md` exists to record.

**Not usable in this environment.** `image-to-code` and `brandkit` both require
image generation. They are installed for completeness and will not work here.

---

## The gate

```bash
npm run verify        # lint → typecheck → test → build (two minutes)
npm run test:screens  # layout, axe, targets, perf, first-screen (about 4 minutes locally (warm build cache), for anything on screen)
npm run test:visual   # opt-in, local baselines
```

A design change is finished when the first two pass and `Visual` has been
looked at. See `docs/DESIGN_GOVERNANCE.md` for what each gate checks and what
budgets only going down means.
