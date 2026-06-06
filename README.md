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
| Backend | AWS Amplify Gen 2 — AppSync (GraphQL), DynamoDB, Lambda |
| Auth | Amazon Cognito + Google OAuth federation |
| Storage | Amazon S3 (trip thumbnails) |
| AI | Google Gemini (via server-side Lambda) |
| Hosting | AWS Amplify Hosting |
| Package manager | pnpm |

## Architecture at a glance

> [!IMPORTANT]
> **Google My Maps has no public API.** The app cannot create or read maps programmatically. A trip's map is **user-supplied**: the user builds it by hand in My Maps and pastes the share/embed URL, which the app validates and renders as a read-only `<iframe>`. Design features around this constraint.

```
Browser (Next.js SSR, mobile-first)
   │
   ├── Amplify Hosting ── serves the app
   ├── AppSync GraphQL ── DynamoDB (Trip, Favorite) + Cognito (Google OAuth)
   ├── S3 ───────────── trip thumbnails
   └── Lambda "suggestTrips" ── Google Gemini (AI suggestions, server-side)
```

See [`docs/road-rash-plan.md`](docs/road-rash-plan.md) for the full data model, authorization rules, search strategy, and risk analysis.

## Getting started

> [!NOTE]
> These steps describe the intended M0 setup. The scaffolding does not exist yet — running them is how you create it.

### Prerequisites

- [Node.js](https://nodejs.org) 20 (an `.nvmrc` is provided — run `nvm use`)
- [pnpm](https://pnpm.io) (`corepack enable` then `corepack prepare pnpm@latest --activate`)
- An AWS account with credentials configured for [Amplify Gen 2](https://docs.amplify.aws/)
- A Google Cloud project with an OAuth client and a Gemini API key

### Setup

```bash
# Scaffold the Amplify Gen 2 + Next.js app (M0)
pnpm create amplify@latest

# Install dependencies
pnpm install

# Copy environment template and fill in your values
cp .env.example .env.local
```

### Develop

```bash
# Start a personal cloud sandbox (watches amplify/ and hot-deploys backend changes)
pnpm ampx sandbox

# In a second terminal, run the Next.js dev server
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Build & lint

```bash
pnpm build   # production build
pnpm lint    # lint
```

## Project structure

```
road-rash/
├── docs/
│   └── road-rash-plan.md   # architecture & development plan (source of truth)
├── CLAUDE.md               # guidance for Claude Code
├── .env.example            # environment variable template
└── (app + amplify/ created during M0 scaffolding)
```

## Roadmap

The build is organized into milestones (full detail in [the plan](docs/road-rash-plan.md)):

- **M0** Project setup · **M1** Auth (Cognito + Google) · **M2** Data + storage
- **M3** Trip CRUD · **M4** Social (favorites) · **M5** Search/filter/grouping
- **M6** AI suggestions (Gemini) · **M7** Maps integration · **M8** Polish + deploy

## Documentation

- [Architecture & development plan](docs/road-rash-plan.md)
- [AWS Amplify Gen 2](https://docs.amplify.aws/)
- [Next.js](https://nextjs.org/docs)
