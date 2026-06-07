# road-rash — Step-by-step implementation guides

This folder breaks `plan/feature-road-rash-mvp-1.md` into one executable guide per
phase (milestone M0–M8). Each file expands the source task table into concrete
sub-steps, the files to create, commands to run, and a verification/done check.

> **Source of truth:** `docs/road-rash-plan.md` and `docs/architecture.md`.
> If a step here conflicts with those, the docs win — fix the step.

## How to use these

1. Work the phases **in order** — each assumes the previous one is done and verified.
2. Treat each task's **Done check** as the gate; don't mark a task complete until it passes.
3. As tasks land, update the `Completed`/`Date` columns in
   `plan/feature-road-rash-mvp-1.md` (the canonical tracker) **and** tick the
   checklist at the bottom of the relevant phase file.
4. Set the front-matter `status` in the source plan to `In progress` once M0 starts.

## Phases

| Phase | Milestone | Guide | Theme |
|-------|-----------|-------|-------|
| 1 | M0 | [phase-1-m0-scaffold-and-bootstrap.md](./phase-1-m0-scaffold-and-bootstrap.md) | Next.js scaffold + Terraform S3 backend + Amplify Hosting |
| 2 | M1 | [phase-2-m1-cognito-auth.md](./phase-2-m1-cognito-auth.md) | Cognito (Google OAuth) + SSR sessions + route guards |
| 3 | M2 | [phase-3-m2-data-api-foundation.md](./phase-3-m2-data-api-foundation.md) | DynamoDB + S3 + API Gateway + JWT authorizer + IAM |
| 4 | M3 | [phase-4-m3-trip-crud.md](./phase-4-m3-trip-crud.md) | Trip CRUD Lambda/routes + form + presign upload + grid |
| 5 | M4 | [phase-5-m4-favorites-and-sharing.md](./phase-5-m4-favorites-and-sharing.md) | Favorites + denormalized count + saved view + share page |
| 6 | M5 | [phase-6-m5-search-filter-group.md](./phase-6-m5-search-filter-group.md) | Search/filter/group via `GET /trips` (DynamoDB Option A) |
| 7 | M6 | [phase-7-m6-ai-suggestions.md](./phase-7-m6-ai-suggestions.md) | Gemini `suggestTrips` Lambda + AI prompt UI + fallback |
| 8 | M7 | [phase-8-m7-trip-detail-modal.md](./phase-8-m7-trip-detail-modal.md) | Trip detail modal + safe My Maps iframe + deep link |
| 9 | M8 | [phase-9-m8-qa-and-launch.md](./phase-9-m8-qa-and-launch.md) | Responsive QA + limits + prod apply + smoke test |

## Conventions used in every guide

- **Package manager:** `pnpm` only (commit `pnpm-lock.yaml`). Never `npm`/`yarn`.
- **Terraform:** single source of truth for all AWS resources; no console edits.
  Run from a per-env root: `terraform -chdir=infra/envs/<env> <cmd>`.
- **Secrets:** SSM Parameter Store (SecureString); read at Lambda runtime by name,
  never baked into code or shipped to the browser.
- **Auth model:** public `GET` routes are open; mutating routes require a Cognito
  JWT (API Gateway authorizer) **and** an owner check in the Lambda (`sub`).
- **The hard constraint:** Google My Maps has **no public API** — the map is
  user-supplied URL data, validated and rendered as a read-only `<iframe>`.
