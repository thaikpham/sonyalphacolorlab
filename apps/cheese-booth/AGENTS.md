# AGENTS.md

## Purpose

This repository keeps a Codex-first documentation pack so future sessions do not have to rescan the full codebase before making safe changes.

Use this file as the entrypoint. Read the linked `docs/ai/*` files before broad codebase scanning.

## Repo Reality

- This repo is the browser kiosk app only.
- Frontend runtime: React 19 + Vite + `HashRouter`.
- Backend runtime: Vercel Functions under `api/*`.
- Cloud share stack: browser upload -> Vercel Function validation -> Cloudflare R2 object storage -> Postgres metadata -> QR gallery.
- Desktop/Tauri work does **not** live here anymore. That continuation lives in `../kiosk-desktop`.

## Read This First

If the task is about repository orientation, routes, or runtime boundaries:
- Read [docs/ai/system-overview.md](docs/ai/system-overview.md)

If the task is about page layout, component ownership, or where to edit UI:
- Read [docs/ai/frontend-pages-and-components.md](docs/ai/frontend-pages-and-components.md)

If the task is about camera/session state, capture flow, QR/share flow, or local side effects:
- Read [docs/ai/state-and-flow-map.md](docs/ai/state-and-flow-map.md)

If the task is about `api/*`, Postgres/R2 integration, gallery/download tokens, or ops boundaries:
- Read [docs/ai/api-and-cloud-share.md](docs/ai/api-and-cloud-share.md)

If the task is about recent architecture or behavior changes:
- Read [docs/ai/change-log.md](docs/ai/change-log.md)

For the full AI docs index:
- Read [docs/ai/README.md](docs/ai/README.md)

## Mandatory Update Rule

When you change any of the following, update the matching AI docs in the same session:

- feature behavior
- route structure
- top-level page composition
- hook orchestration
- API route behavior
- backend integration boundaries
- source-of-truth module ownership

Also add one short entry to [docs/ai/change-log.md](docs/ai/change-log.md) for any important flow, architecture, or information-architecture change.

Do **not** skip the docs update just because the code change is small.

## When Docs Must Change

Update the relevant `docs/ai/*` file when a change affects:

- component responsibility
- state or lifecycle transitions
- route ownership
- integration boundaries
- where future agents should edit behavior

Usually skip docs updates for pixel-only CSS tweaks unless they change:

- interaction flow
- page composition
- information architecture
- edit guidance

## Existing Ops Docs

For deployment and cloud-share operations, do not rewrite long operational instructions into the AI docs. Cross-reference the existing docs in `docs/`:

- [docs/vercel-r2-cloud-share-checklist.md](docs/vercel-r2-cloud-share-checklist.md)
- [docs/vercel-dev-cloud-share-quickstart.md](docs/vercel-dev-cloud-share-quickstart.md)
- [docs/cloud-share-operator-runbook.md](docs/cloud-share-operator-runbook.md)
- [docs/internal-event-ops-go-live-checklist.md](docs/internal-event-ops-go-live-checklist.md)
