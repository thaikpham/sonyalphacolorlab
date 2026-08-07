# Deploying the monorepo

Three apps, one repo, three Vercel projects. Nothing about the deploy targets
changes — the URLs, the env vars and the domains stay where they are. What
changes is which repo each project watches and which directory it builds.

## What breaks if you do nothing

Pushing this repo does **not** break anything that is live today. The existing
deployments keep serving.

What stops working is *future* deploys of the two sibling apps: their Vercel
projects are still connected to `thaikpham/cheese-booth` and
`thaikpham/sonylivesop`, and those repos will not receive commits any more. The
apps will quietly freeze at their last deploy until reconnected.

## Reconnect the two sibling projects

For each of the CheeseBooth and Live SOP projects, in **Settings → Git**:

1. Disconnect the old repository.
2. Connect `thaikpham/sonyalphacolorlab`.
3. Set **Root Directory**:
   - CheeseBooth → `apps/cheese-booth`
   - Live SOP → `apps/live-sop`
4. Leave "Include files outside the root directory" **on**. Both apps import
   generated files from `packages/colorlab-tokens`, and the install needs the
   root lockfile.

The Alpha ColorLab project needs no change: it still builds from the repo root.

## Stop all three rebuilding on every push

By default a push rebuilds every connected project, so a typo fix in Live SOP
would also rebuild ColorLab and CheeseBooth. Set **Settings → Git → Ignored
Build Step** per project to skip when nothing it depends on changed:

CheeseBooth:
```bash
git diff --quiet HEAD^ HEAD -- apps/cheese-booth packages/colorlab-tokens package-lock.json
```

Live SOP:
```bash
git diff --quiet HEAD^ HEAD -- apps/live-sop packages/colorlab-tokens package-lock.json
```

Alpha ColorLab:
```bash
git diff --quiet HEAD^ HEAD -- src public messages data supabase next.config.ts package-lock.json packages/colorlab-tokens
```

Exit 0 means "skip the build", which is what `git diff --quiet` returns when
there is no difference. Each list includes `packages/colorlab-tokens`, because
a token change is meant to reach all three.

## Environment variables

They stay per-project; nothing is shared. Two worth re-checking while you are
in there:

- **`VITE_GEMINI_API_KEY` on the Live SOP project — delete it.** A
  `VITE_`-prefixed variable is inlined into the browser bundle. The code no
  longer reads it, but leaving it set is a loaded gun for whoever re-adds a
  reference. The AI panels are bring-your-own-key.
- CheeseBooth's `CRON_SECRET`, `POSTGRES_URL` and R2 keys are untouched by the
  move, and its cron path in `apps/cheese-booth/vercel.json` is still
  `/api/cron/cleanup-expired` — relative to that project's root directory, so
  it resolves the same.

## The old repos

Keep `thaikpham/cheese-booth` and `thaikpham/sonylivesop` around, archived
rather than deleted. Their history is already inside this repo via
`git subtree`, so nothing is lost either way — but an archived repo keeps old
issue links and release pages resolving.

CheeseBooth's release workflow moved to `.github/workflows/release-cheese-booth.yml`.
Its tags will now live alongside ColorLab's, so prefix them (`cheese-booth-v0.1.5`)
to keep the two release streams apart.
