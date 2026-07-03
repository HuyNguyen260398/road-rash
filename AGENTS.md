# Repository Guidelines

## Project Structure & Module Organization

`road-rash` is a Next.js App Router project backed by AWS Lambda services and Terraform-managed infrastructure. The MVP is largely built (milestones M0–M7 landed; M8 in progress). Frontend routes live in `app/`, reusable React UI in `components/`, and shared TypeScript utilities in `lib/`. Lambda handlers live under `services/<name>/` — `trips`, `favorites`, `presign`, and `suggest-trips` — with common helpers in `services/shared/` and bundled output in ignored `services/**/dist/`. Terraform is split into `infra/bootstrap`, `infra/envs/{staging,prod}`, and reusable `infra/modules/*`. Planning and architecture references live in `docs/` (start with `docs/Project_Architecture_Blueprint.md`; per-task status in `docs/plan/`).

## Build, Test, and Development Commands

Use `pnpm` only; `pnpm-lock.yaml` is committed and the package declares Node `>=24`.

- `pnpm dev` starts the local Next.js server.
- `pnpm build` creates the production build and runs Next.js type checks.
- `pnpm lint` runs ESLint with Next.js TypeScript rules.
- `pnpm test` runs the Vitest suite once; pass a file path or `-t` filter for focused runs.
- `pnpm test:watch` runs Vitest in watch mode.
- `pnpm build:lambdas` bundles each Lambda handler with esbuild before Terraform plans or applies.
- `terraform -chdir=infra/envs/staging plan` previews AWS changes after bootstrap/init.

## Coding Style & Naming Conventions

Write TypeScript and React using the existing module style: named exports for shared helpers, PascalCase component files such as `TripCard.tsx`, and kebab-case service folders such as `suggest-trips`. Keep tests beside the code they cover as `*.test.ts`. Run `pnpm format:check` before broad edits and `pnpm format` only when intentionally formatting the tree.

## Testing Guidelines

Unit tests use Vitest. Cover validation, search/filtering, service selection logic, and Lambda input handling near the changed code. Prefer small deterministic tests with explicit fixtures. For UI changes, at minimum run `pnpm lint`, `pnpm test`, and `pnpm build`; backend service changes should also run `pnpm build:lambdas`.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit-style prefixes, for example `ci(deploy): ...`, `fix(infra): ...`, and `docs: ...`. Keep commits focused and imperative. PRs should include a concise summary, verification commands run, linked issues or plan tasks when relevant, and screenshots for visible UI changes. Note any required environment, Terraform, or deployment follow-up. PR CI gates (`nextjs-ci.yaml`, `tf-ci.yaml`) run lint, `format:check`, build, test, and Terraform fmt/validate/tflint — run these locally before pushing. Deployment workflows are disabled under `.github/workflows-disabled/`; merging to `main` does not deploy to AWS.

## Security & Configuration Tips

Never commit `.env.local`, Terraform state, AWS credentials, or Gemini keys. Start from `.env.example` for local config. Terraform owns AWS resources; avoid manual console drift. Google My Maps data is user-supplied only, so do not add code that assumes programmatic map access.
