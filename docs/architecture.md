# road-rash — Architecture Document

**Status:** Draft (pre-implementation)
**Last updated:** 2026-06-06
**Companion documents:** [`road-rash-plan.md`](road-rash-plan.md) (product plan), [`../plan/feature-road-rash-mvp-1.md`](../plan/feature-road-rash-mvp-1.md) (implementation plan)

---

## 1. Overview

road-rash is a mobile-first, server-rendered web application for creating, sharing, and discovering travel trip plans. Each trip is centered on a user-supplied **Google My Maps** route, enriched with structured metadata (location, duration, vehicle, type), a thumbnail, and social signals (favorites). Discovery is powered by structured search/filtering and an AI suggestion flow backed by Google Gemini.

The frontend is a Next.js (App Router, SSR) app hosted on **AWS Amplify Hosting**. The backend is a serverless REST API — **API Gateway → Lambda → DynamoDB** — with **Amazon Cognito** for auth and **S3** for media. **All AWS resources are provisioned with Terraform**, with remote state in an S3 backend. There is no Amplify Gen 2 backend and no AppSync/GraphQL.

### 1.1 Quality attributes (drivers)

| Attribute | Target / approach |
|---|---|
| Mobile-first UX | Responsive layouts, SSR for fast first paint, deep links to native maps |
| Low cost at launch | Serverless, pay-per-use; DynamoDB-only search (no OpenSearch) |
| Public discoverability | Guest (unauthenticated) read access via public GET routes |
| Security of secrets | API keys/secrets in SSM, server-side only |
| Reproducible infra | Everything in Terraform; remote state; per-env config |

---

## 2. The defining constraint: My Maps has no API

Google My Maps exposes **no public API**. The application cannot create, read, or edit a My Maps map programmatically. Consequently:

- The map is **user-supplied data**. The user builds the map by hand in My Maps and pastes its share/embed URL into the trip form.
- The app **validates** the URL (host/path allow-list), **stores the string**, and renders it as a **read-only `<iframe>`**.
- The "Open in Google Maps" action is a **separate, best-effort deep link** for native-app handoff on mobile — not guaranteed, and not tied to the My Maps embed.

Every downstream decision respects this constraint; no integration assumes programmatic map access.

---

## 3. System context (C4 Level 1)

```
        ┌──────────────┐         ┌──────────────────────┐
        │   Visitor    │         │  Authenticated user  │
        │  (guest)     │         │  (trip author)       │
        └──────┬───────┘         └──────────┬───────────┘
               │  browse/search             │  create/edit/favorite
               ▼                            ▼
        ┌─────────────────────────────────────────────┐
        │              road-rash web app               │
        │        (Next.js SSR on Amplify Hosting)      │
        └───┬───────────┬──────────────┬───────────┬───┘
            │           │              │           │
            ▼           ▼              ▼           ▼
     ┌──────────┐ ┌──────────┐  ┌───────────┐ ┌─────────┐
     │ Google   │ │ Google   │  │  Google   │ │  AWS    │
     │ OAuth    │ │ My Maps  │  │  Gemini   │ │ backend │
     │ (idP)    │ │ (iframe) │  │  (AI)     │ │(REST API)│
     └──────────┘ └──────────┘  └───────────┘ └─────────┘
```

External systems:
- **Google OAuth** — identity provider federated into Cognito.
- **Google My Maps** — embedded read-only via iframe (no API).
- **Google Gemini** — AI ranking, called server-side from Lambda only.
- **Google Maps deep link** — native handoff target on mobile.

---

## 4. Container view (C4 Level 2)

```
┌──────────────────────── AWS (all via Terraform) ──────────────────────┐
│                                                                        │
│  Amplify Hosting ── Next.js (App Router, SSR + client)                 │
│        │                                                               │
│        │  HTTPS (fetch + Cognito JWT)                                  │
│        ▼                                                               │
│   ┌──────────────┐   JWT authorizer    ┌─────────────────┐            │
│   │ API Gateway  │◀───────────────────▶│   Cognito       │            │
│   │ (HTTP API)   │                      │ User Pool +     │            │
│   └──────┬───────┘                      │ Identity Pool   │            │
│          │ Lambda proxy                 │ (Google fed.)   │            │
│          ▼                              └─────────────────┘            │
│   ┌──────────────────────────────┐                                     │
│   │ Lambda functions             │                                     │
│   │  • trips (CRUD)              │── AWS SDK ─▶ ┌──────────┐           │
│   │  • favorites                │              │ DynamoDB │           │
│   │  • presign (S3 upload URL)  │              │ Trip /   │           │
│   │  • suggestTrips ────────────┼── HTTPS ─▶   │ Favorite │           │
│   └──────────────┬──────────────┘   Gemini API └──────────┘           │
│                  │ presigned PUT/GET                                    │
│                  ▼                                                      │
│            ┌──────────┐        ┌───────────────┐    ┌──────────────┐   │
│            │ S3       │        │ SSM Parameter │    │ S3 (TF state)│   │
│            │ thumbnails│       │ Store (secrets)│   │ remote backend│  │
│            └──────────┘        └───────────────┘    └──────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

| Container | Technology | Responsibility |
|---|---|---|
| Web app | Next.js App Router (SSR + client) | UI, routing, SSR data fetch, auth-gated pages |
| REST API | API Gateway (HTTP API) + Cognito JWT authorizer | Routing, auth gating, CORS |
| Compute | Lambda (Node/TypeScript) | Trip/Favorite logic, presigned URLs, Gemini call |
| Identity | Cognito User Pool + Identity Pool | Google federation, JWTs, guest creds |
| Database | DynamoDB | Trip and Favorite tables + GSIs |
| Object storage | S3 (thumbnails) | Trip images via presigned URLs |
| Secrets | SSM Parameter Store | Gemini key, Google OAuth secret |
| IaC state | S3 (versioned, encrypted) | Terraform remote state + locking |

### 4.1 AWS service inventory

| # | Service | Role | Provisioned by |
|---|---|---|---|
| 1 | Amplify Hosting | Next.js SSR build & hosting, branch deploys | Terraform (`aws_amplify_app`/`_branch`) |
| 2 | Cognito (User + Identity Pool) | Google OAuth, JWTs, guest access | Terraform |
| 3 | API Gateway (HTTP API) | REST entry point + JWT authorizer | Terraform |
| 4 | Lambda | Trip CRUD, favorites, presign, suggestTrips | Terraform |
| 5 | DynamoDB | Trip + Favorite tables / GSIs | Terraform |
| 6 | S3 (thumbnails) | Media storage | Terraform |
| 7 | S3 (state) | Terraform remote backend | Bootstrap, then self-managed |
| 8 | SSM Parameter Store | Secrets | Terraform |
| 9 | IAM | Least-privilege roles/policies | Terraform |
| 10 | CloudWatch Logs | Lambda/API logs | Terraform |

CloudFront fronts Amplify Hosting but is Amplify-managed (not authored directly).

---

## 5. Frontend architecture

- **Next.js App Router**, SSR-first for fast mobile first paint and shareable public pages.
- **Server components** render public/listing data (Home, public `/trip/[id]`) by calling the public REST GET routes; **client components** (`'use client'`) handle interactivity (favorite toggle, AI box, forms, modal) and send the Cognito JWT in the `Authorization` header.
- **Auth/session**: Amplify JS Auth (`aws-amplify/auth`) is configured **manually** to point at the Terraform-created Cognito User Pool + Identity Pool (no `amplify_outputs.json`). SSR session handling uses `@aws-amplify/adapter-nextjs` (`createServerRunner`).
- **Runtime config**: Cognito IDs, API base URL, and region come from Amplify Hosting environment variables populated from Terraform outputs.
- **Routing map**:

  | Route | Access | Rendering |
  |---|---|---|
  | `/` (Home/Discover) | public | SSR list + client controls |
  | `/trip/[id]` | public | SSR (OG metadata) |
  | `/login` | public | client |
  | `/trips/new` | auth | client form |
  | `/trips/[id]/edit` | owner | client form |
  | `/my-trips` | auth | SSR + client |
  | `/saved` | auth | SSR + client |

---

## 6. API architecture

REST over API Gateway (HTTP API). Mutating routes require a valid Cognito JWT (authorizer); GET trip routes are public.

| Method & route | Auth | Lambda | Purpose |
|---|---|---|---|
| `GET /trips` | public | trips | List/search/filter trips |
| `GET /trips/{id}` | public | trips | Single trip |
| `POST /trips` | JWT | trips | Create (sets `authorId` = caller `sub`) |
| `PUT /trips/{id}` | JWT (owner) | trips | Update own trip |
| `DELETE /trips/{id}` | JWT (owner) | trips | Delete own trip |
| `GET /favorites` | JWT | favorites | Caller's favorites |
| `POST /favorites` | JWT | favorites | Favorite a trip (+ inc `favoriteCount`) |
| `DELETE /favorites/{tripId}` | JWT | favorites | Unfavorite (+ dec `favoriteCount`) |
| `POST /uploads/presign` | JWT | presign | Presigned S3 PUT URL for a thumbnail |
| `POST /suggest` | public/JWT | suggestTrips | AI suggestions |

Ownership is enforced **in the Lambda** by comparing the JWT `sub` claim to `authorId`/`userId` — there is no field-level auth engine.

---

## 7. Data architecture

Two DynamoDB tables (provisioned via Terraform), accessed by Lambda via the AWS SDK. Full field tables: [`road-rash-plan.md` §3](road-rash-plan.md).

### 7.1 Trip
- `favoriteCount` is **denormalized** (updated on favorite/unfavorite) — never computed by scanning `Favorite` at read time.
- `thumbnailKey` references an S3 object; the UI gets a presigned GET URL.
- `myMapsUrl` / `googleMapsUrl` are validated user-supplied strings.
- Structured `city`/`province`/`country`/`tripType`/`vehicle` exist to make filtering/grouping efficient.

### 7.2 Favorite
- Composite uniqueness on (`tripId`, `userId`) prevents double-favoriting.
- `userId` GSI powers the "saved trips" view.

### 7.3 Indexing for search/filter (Option A)
GSIs on `Trip` for `country`/`province`/`city`/`tripType`/`vehicle` make each filter an efficient query. Free-text search uses DynamoDB `contains` filter expressions and/or client-side case-insensitive substring matching over the candidate set. OpenSearch (Option B) is deferred until scale demands it.

### 7.4 Authorization model
| Layer | Control |
|---|---|
| Edge | API Gateway Cognito JWT authorizer on mutating routes; public GET routes |
| Application | Lambda compares JWT `sub` to `authorId`/`userId` |
| Infrastructure | Lambda IAM roles scoped to specific tables/bucket (least privilege) |
| Guest | Public GET routes; Identity Pool unauthenticated role only where temp AWS creds are needed |

---

## 8. AI suggestion architecture

```
Browser ──(explicit submit: prompt)──▶ POST /suggest (API Gateway)
                                            │
                                            ▼
                                   Lambda "suggestTrips"
                                   1. query DynamoDB for candidate trips
                                   2. build compact prompt (trips + user prompt)
                                   3. call Gemini API (key from SSM, server-side)
                                   4. parse ranked [{id, reason}]
                                   5. KEEP ONLY ids in the candidate set
                                            │
                                            ▼
                                   return Trip[] (+ optional reason)
Browser renders suggested cards; on error → fall back to plain search
```

Guardrails:
- **Key isolation** — `GEMINI_API_KEY` lives in SSM Parameter Store (SecureString), read by the Lambda at runtime; never reaches the browser.
- **No hallucinated trips** — Gemini ranks only from candidate IDs passed in; returned IDs validated against DynamoDB before render.
- **Cost/latency** — explicit submit only (never per-keystroke); bounded Lambda timeout; plain search is the fallback.

---

## 9. Storage & media

- Browser requests a **presigned PUT URL** (`POST /uploads/presign`), uploads the image directly to S3, and stores the returned key in `thumbnailKey`.
- Reads use a presigned GET URL (or a public-read CDN path later).
- The bucket is private with a public-access block; CORS allows browser PUT/GET.
- Upload constraints (content-type `image/*`, max size) enforced client-side and re-checked in the presign Lambda.

---

## 10. Authentication & session flow

```
User clicks "Sign in with Google"
   └▶ signInWithRedirect({ provider: 'Google' })   (Amplify JS Auth → Cognito Hosted UI)
        └▶ Cognito Hosted UI ── Google OAuth ── callback
             └▶ Cognito issues JWTs; Amplify stores SSR-compatible cookies
                  └▶ client sends JWT in Authorization header to API Gateway
                  └▶ SSR reads session via runWithAmplifyServerContext(fetchAuthSession)
```

- Cognito is the Terraform-provisioned User Pool; Amplify JS is configured to use it (no Amplify backend).
- Guests use public GET routes; the Identity Pool unauthenticated role supplies temp creds only when needed.

---

## 11. Infrastructure as code (Terraform)

- **Layout**: `infra/` with modules per concern (`cognito`, `dynamodb`, `s3`, `lambda`, `apigateway`, `hosting`, `iam`) and per-environment roots/configs (`staging`, `prod`).
- **Remote state**: S3 bucket (versioned, SSE-encrypted) via `backend "s3"`. **State locking** uses S3 native locking (`use_lockfile = true`, Terraform ≥ 1.10); DynamoDB lock table is an optional fallback.
- **Bootstrap ordering**: the state bucket must exist before the backend block uses it — create via a one-time bootstrap (local state → `terraform init -migrate-state`) or a separate bootstrap module.
- **Outputs → app**: Terraform outputs (Cognito IDs, API base URL, region, bucket) feed Amplify Hosting environment variables; the frontend reads them at build/runtime. No `amplify_outputs.json`.
- **Secrets**: written to SSM Parameter Store per environment; Lambda reads at runtime, never committed.

---

## 12. Deployment & environments

- **Package manager:** pnpm (lockfile committed). Amplify Hosting build spec enables corepack/pnpm and `pnpm install --frozen-lockfile`.
- **App deploys:** branch-based via Amplify Hosting — `main` → production, `staging` → pre-prod.
- **Infra deploys:** `terraform plan`/`apply` per environment (ideally gated in CI); Terraform as the single source of truth — avoid manual console edits.
- **Lambda packaging:** TypeScript built/bundled and deployed via Terraform (zip or container image).

---

## 13. Security considerations

| Concern | Control |
|---|---|
| Secret leakage | Gemini key + OAuth secret in SSM, server-side only |
| Unauthorized writes | API Gateway JWT authorizer + Lambda ownership checks |
| Over-broad permissions | Per-function least-privilege IAM roles |
| iframe injection | My Maps URL host/path allow-list + sanitization before embed |
| Malicious uploads | Content-type + size limits on presign + client |
| AI hallucination | Candidate-set ID filtering before render |
| State tampering | Encrypted, versioned, locked S3 state; no manual edits |
| Spam trips | Auth required to create; moderation/report deferred |

---

## 14. Key architecture decisions (ADR summary)

| ID | Decision | Rationale | Alternative rejected |
|---|---|---|---|
| AD-01 | My Maps via user-pasted URL + iframe | No public API exists | Programmatic map integration (impossible) |
| AD-02 | Terraform provisions all AWS resources | Reproducible IaC, single source of truth | Amplify Gen 2 backend-as-code |
| AD-03 | S3 remote state backend (native locking) | Durable, shareable, locked state | Local state; DynamoDB lock table (optional) |
| AD-04 | API Gateway + Lambda (REST) | Natural to express fully in Terraform | AppSync GraphQL |
| AD-05 | Amplify Hosting for the frontend | Easy git-based SSR deploys, TF-manageable | S3+CloudFront; Vercel |
| AD-06 | DynamoDB-only search at launch | Cheapest, sufficient at scale | OpenSearch (Option B), deferred |
| AD-07 | Denormalized `favoriteCount` | Cheap reads for the card grid | Live count from Favorite scans |
| AD-08 | Gemini via Lambda behind `/suggest` | Protects key; server-side only | Browser-side call |
| AD-09 | Secrets in SSM Parameter Store | Server-side, per-env, TF-managed | Hardcoded/env-committed secrets |
| AD-10 | Responsive web, not PWA | Faster MVP | PWA (phase 2) |

---

## 15. Risks & future evolution

See [`road-rash-plan.md` §6–§7](road-rash-plan.md) for the full risk table and open questions. Evolution paths:
- Personalize AI suggestions using favorites/history.
- Comments/ratings on trips.
- PWA/installability (phase 2).
- Auto-generate thumbnails when the user skips upload.
- Migrate to OpenSearch if search volume/quality demands it.
- Stream-driven reconciliation of `favoriteCount` if drift becomes material.
- CDN/public-read thumbnails if presigned GETs become a bottleneck.
