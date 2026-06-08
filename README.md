# road-rash

A mobile-first web app for creating, sharing, and discovering travel trip plans, built around Google My Maps. Plan a road trip, attach your My Maps route, add a thumbnail, and share it — others can browse, search, favorite, and get AI-powered suggestions for where to ride next.

> [!NOTE]
> This repository is at the **planning stage**. The architecture, data model, and milestones are defined in [`docs/road-rash-plan.md`](docs/road-rash-plan.md); application code does not exist yet. Start with milestone **M0 — Project setup**.

## Features

- **Discover trips** — responsive grid of trip cards (thumbnail, location, duration, vehicle, author, favorites). Public, no sign-in required to browse.
- **Create & share trips** — structured location fields, trip type and vehicle pickers, thumbnail upload, and a pasted Google My Maps link rendered as an embedded map.
- **Search, filter & group** — by name, location, city, province, country, trip type, and vehicle.
- **Favorites** — heart trips with optimistic UI and a personal saved-trips view.
- **AI trip suggestions** — describe what you're after and get ranked recommendations from existing trips, powered by Google Gemini (server-side).
- **Open in Google Maps** — best-effort mobile deep link to the native app.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router, SSR) |
| Backend API | API Gateway (HTTP API) → AWS Lambda → DynamoDB (REST) |
| Auth | Amazon Cognito (User + Identity Pool) + Google OAuth federation |
| Storage | Amazon S3 (trip thumbnails, presigned URLs) |
| AI | Google Gemini (via server-side Lambda) |
| Secrets | AWS SSM Parameter Store |
| Infrastructure | Terraform (all AWS resources), S3 remote state backend |
| Hosting | AWS Amplify Hosting |
| Package manager | pnpm |

## Architecture at a glance

> [!IMPORTANT]
> **Google My Maps has no public API.** The app cannot create or read maps programmatically. A trip's map is **user-supplied**: the user builds it by hand in My Maps and pastes the share/embed URL, which the app validates and renders as a read-only `<iframe>`. Design features around this constraint.

```
Browser (Next.js SSR, mobile-first)  ── hosted on Amplify Hosting
   │  fetch + Cognito JWT
   ▼
API Gateway (HTTP API, JWT authorizer)
   ▼
Lambda (trips · favorites · presign · suggestTrips)
   ├── DynamoDB (Trip, Favorite tables + GSIs)
   ├── S3 (thumbnails, presigned URLs)
   ├── SSM Parameter Store (secrets)
   └── Google Gemini (AI suggestions, server-side)

Cognito (User + Identity Pool) ── Google OAuth federation
All AWS resources provisioned by Terraform (S3 remote state).
```

See [`docs/architecture.md`](docs/architecture.md) and [`docs/road-rash-plan.md`](docs/road-rash-plan.md) for the full data model, authorization model, search strategy, and risk analysis.

## Getting started

> [!NOTE]
> These steps describe the intended M0 setup. The scaffolding does not exist yet — running them is how you create it.

### Prerequisites

- [Node.js](https://nodejs.org) 20 (an `.nvmrc` is provided — run `nvm use`)
- [pnpm](https://pnpm.io) (`corepack enable` then `corepack prepare pnpm@latest --activate`)
- [Terraform](https://developer.hashicorp.com/terraform) ≥ 1.10 and an AWS account with credentials configured
- A Google Cloud project with an OAuth client and a Gemini API key

### Setup

```bash
# Scaffold the Next.js app (M0)
pnpm create next-app

# Install dependencies
pnpm install

# Copy environment template and fill in your values
cp .env.example .env.local
```

```bash
# Provision AWS infrastructure (see infra/README.md for bootstrap ordering)
# 1) one-time: create the S3 state bucket
terraform -chdir=infra/bootstrap init && terraform -chdir=infra/bootstrap apply
# 2) provision an environment
terraform -chdir=infra/envs/staging init
terraform -chdir=infra/envs/staging apply
```

### Develop

```bash
# Run the Next.js dev server (uses Terraform outputs via env vars)
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Build & lint

```bash
pnpm build   # production build
pnpm lint    # lint
```

### Test

Unit tests run on [Vitest](https://vitest.dev).

```bash
pnpm test                       # run the whole suite once
pnpm test lib/validation.test.ts  # run a single file
pnpm test -t "rejects http"     # run tests matching a name
pnpm test:watch                 # watch mode
```

## Project structure

```
road-rash/
├── docs/
│   ├── road-rash-plan.md   # architecture & development plan (source of truth)
│   └── architecture.md     # architecture document (C4, ADRs, service inventory)
├── plan/                   # executable implementation plan (M0–M8 tasks)
├── infra/                  # Terraform (created during M0): bootstrap, modules, envs
├── services/               # Lambda handlers (created during M3+)
├── CLAUDE.md               # guidance for Claude Code
└── (app/, components/, lib/ created during M0 scaffolding)
```

## Roadmap

The build is organized into milestones (full detail in [the plan](docs/road-rash-plan.md)):

- **M0** Project + Terraform setup · **M1** Auth (Cognito + Google) · **M2** Data + storage
- **M3** Trip CRUD · **M4** Social (favorites) · **M5** Search/filter/grouping
- **M6** AI suggestions (Gemini) · **M7** Maps integration · **M8** Polish + deploy

## Documentation

- [Architecture document](docs/architecture.md)
- [Architecture & development plan](docs/road-rash-plan.md)
- [Implementation plan](plan/feature-road-rash-mvp-1.md)
- [Terraform](https://developer.hashicorp.com/terraform) · [AWS Amplify Hosting](https://docs.amplify.aws/nextjs/start/) · [Next.js](https://nextjs.org/docs)
