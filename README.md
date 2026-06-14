# road-rash

A mobile-first web app for creating, sharing, and discovering travel trip plans, built around Google My Maps. Plan a road trip, attach your My Maps route, add a thumbnail, and share it — others can browse, search, favorite, and get AI-powered suggestions for where to ride next.

> [!NOTE]
> The MVP is **largely built**. Milestones **M0–M7 have landed** (auth, trip CRUD, favorites, search/filter/group, AI suggestions, and the trip detail modal); **M8 (QA + launch)** is in progress. CI deploys `main` to a live **staging** environment; there is no prod deployment yet. See [`docs/Project_Architecture_Blueprint.md`](docs/Project_Architecture_Blueprint.md) for a code-grounded architecture reference and [`docs/plan/feature-road-rash-mvp-1.md`](docs/plan/feature-road-rash-mvp-1.md) for the per-task status.

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

### Prerequisites

- [Node.js](https://nodejs.org) 24 (an `.nvmrc` is provided — run `nvm use`)
- [pnpm](https://pnpm.io) 11 (`corepack enable` activates the version pinned in `package.json`)
- [Terraform](https://developer.hashicorp.com/terraform) ≥ 1.10 and an AWS account with credentials configured (only needed to provision/deploy infrastructure)
- A Google Cloud project with an OAuth client and a Gemini API key (for auth + AI features)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment template and fill in your values
# (NEXT_PUBLIC_* Cognito/API values come from Terraform outputs)
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
├── app/                    # Next.js App Router pages (SSR; home, trip, saved, my-trips, login)
├── components/             # React UI (TripBrowser, FavoritesProvider, TripDetailModal, ui/*)
├── lib/                    # Typed API client, search, validation, domain types, Amplify config
├── services/               # Lambda handlers: trips, favorites, presign, suggest-trips (+ shared/)
├── infra/                  # Terraform: bootstrap, modules/*, envs/{staging,prod}
├── scripts/                # Seed + favoriteCount reconcile scripts
├── docs/
│   ├── road-rash-plan.md                  # product & development plan
│   ├── architecture.md                    # architecture document (C4, ADRs)
│   └── Project_Architecture_Blueprint.md  # code-grounded architecture reference
├── plan/                   # executable implementation plan (M0–M8 tasks)
└── CLAUDE.md / AGENTS.md   # contributor + agent guidance
```

## Roadmap

The build is organized into milestones (full detail in [the plan](docs/road-rash-plan.md)). **M0–M7 are complete; M8 is in progress.**

- ✅ **M0** Project + Terraform setup · ✅ **M1** Auth (Cognito + Google) · ✅ **M2** Data + storage
- ✅ **M3** Trip CRUD · ✅ **M4** Social (favorites) · ✅ **M5** Search/filter/grouping
- ✅ **M6** AI suggestions (Gemini) · ✅ **M7** Maps integration (detail modal) · 🚧 **M8** Polish + prod deploy

## Documentation

- [Architecture diagrams](docs/architecture-diagrams.md) — Mermaid: AWS resources, flows, data model, CI/CD
- [Architecture blueprint](docs/Project_Architecture_Blueprint.md) — code-grounded reference
- [Architecture document](docs/architecture.md) — C4 views & ADRs
- [Architecture & development plan](docs/road-rash-plan.md)
- [Implementation plan](docs/plan/feature-road-rash-mvp-1.md)
- [AWS deployment](docs/aws-deployment.md)
- [Terraform](https://developer.hashicorp.com/terraform) · [AWS Amplify Hosting](https://docs.amplify.aws/nextjs/start/) · [Next.js](https://nextjs.org/docs)
