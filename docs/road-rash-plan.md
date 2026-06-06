# road-rash — Architecture & Development Plan

A mobile-oriented web app for creating, sharing, and discovering travel trip plans, built around Google My Maps and Google Maps.

**Stack:** Next.js · AWS (Amplify Hosting, Cognito, API Gateway, Lambda, DynamoDB, S3) · Google OAuth · Google Gemini (AI trip suggestions)
**Infrastructure:** Terraform (all AWS resources), with an S3 backend for remote state
**Package manager:** pnpm
**Last updated:** 2026-06-06

---

## 1. Locked decisions

| Question | Decision |
|---|---|
| Thumbnails | Upload images to S3 (via presigned URL from a Lambda) |
| Mobile-oriented | Responsive web only (not a PWA, for now) |
| Trip browsing | Public — anyone can browse shared trips |
| My Maps link in detail popup | Embedded iframe preview |
| Infrastructure as code | Terraform provisions all AWS resources; remote state in an S3 backend |
| API style | REST via API Gateway (HTTP API) → Lambda → DynamoDB (no AppSync/GraphQL) |
| Hosting | AWS Amplify Hosting for the Next.js SSR app (provisioned via Terraform) |

### The key architectural constraint
Google My Maps has **no public API**. The app cannot create, edit, or read a My Maps map programmatically. The "My Maps link" on a trip is therefore **user-supplied data**: the user creates their map manually in the My Maps UI and pastes the share/embed URL into the trip form. The app stores the string, validates it, and renders it as an embedded iframe. The "open in Google Maps" action is a separate, reliable mobile deep-link handoff.

---

## 2. System architecture

> All AWS resources below are provisioned by **Terraform** (remote state in an S3 backend). Amplify is used only as a **hosting/CI target** for the Next.js app — there is no Amplify Gen 2 backend.

```
                        ┌─────────────────────────────┐
                        │   Browser (mobile-first)    │
                        │   Next.js App Router (SSR)  │
                        └──────────────┬──────────────┘
                                       │
                  ┌────────────────────┼────────────────────┐
                  │                    │                    │
          ┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
          │ Amplify Hosting│  │  API Gateway    │  │   S3 (bucket)   │
          │ (Next.js SSR)  │  │  (HTTP API)     │  │  trip thumbnails│
          └────────────────┘  └────┬───────┬────┘  └────────▲────────┘
                                    │       │ JWT authorizer  │ presigned
                              ┌─────▼─────┐ │ (Cognito)       │ PUT/GET
                              │  Lambda   │ │                 │
                              │ functions │─┼─────────────────┘
                              │ (CRUD,    │ │
                              │  favorites)│ │
                              └─────┬─────┘ │
                         ┌──────────▼──┐ ┌──▼──────────┐
                         │  DynamoDB   │ │  Cognito    │
                         │ Trip /      │ │ User Pool + │
                         │ Favorite    │ │ Identity Pool│
                         │ tables      │ │ + Google fed.│
                         └─────────────┘ └─────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  Google OAuth     │
                                    │  (Identity Prov.) │
                                    └───────────────────┘

   AI suggestion flow (separate path):
   Browser ──prompt──▶ API Gateway route ──▶ Lambda "suggestTrips"
                                                │      ┌──────────────┐
                                                │─────▶│ Google Gemini│
                                                │◀─────│ API          │
                                                │ queries DynamoDB for candidates,
                                                │ sends compact trip list + prompt,
                                                ▼ returns ranked/suggested trip IDs
                                          Browser renders suggested trip cards
```

### External integrations (no SDK lock-in)
- **Google My Maps** — embedded read-only via `<iframe>` in the detail popup. No API.
- **Google Maps deep link** — "Open in Google Maps" button; a maps URL that opens the native app on mobile when installed, else the web.
- **Google Gemini** — called server-side from a Lambda (never the browser, to protect the API key). Takes the user's search/prompt plus a candidate set of trips and returns suggested/ranked trips.

---

## 2a. Infrastructure & provisioning (Terraform)

All AWS resources are defined as code in **Terraform** and provisioned with `terraform apply`. Amplify is used purely as a hosting/CI target for the Next.js app — there is **no** Amplify Gen 2 backend (`ampx`, `defineData`/`defineAuth`) and no AppSync.

### AWS services (provisioned by Terraform)
| Service | Purpose | Key Terraform resources |
|---|---|---|
| **Amplify Hosting** | Build & host the Next.js SSR app; branch deploys | `aws_amplify_app`, `aws_amplify_branch` |
| **Cognito** | Auth: User Pool + Google federation; Identity Pool for guest creds | `aws_cognito_user_pool`, `_user_pool_client`, `_user_pool_domain`, `_identity_provider`, `_identity_pool`, `_identity_pool_roles_attachment` |
| **API Gateway (HTTP API)** | REST entry point with Cognito JWT authorizer | `aws_apigatewayv2_api`, `_route`, `_integration`, `_authorizer`, `_stage` |
| **Lambda** | Trip CRUD, favorites, presigned-URL issuer, `suggestTrips` | `aws_lambda_function`, `aws_lambda_permission` |
| **DynamoDB** | `Trip` and `Favorite` tables + GSIs | `aws_dynamodb_table` |
| **S3 (thumbnails)** | Trip thumbnail storage via presigned URLs | `aws_s3_bucket` (+ CORS, policy, public-access-block) |
| **S3 (TF state)** | Remote Terraform state backend | `aws_s3_bucket` (versioned, encrypted) + `backend "s3"` |
| **SSM Parameter Store** | Secrets (`GEMINI_API_KEY`, Google OAuth secret) | `aws_ssm_parameter` (SecureString) |
| **IAM** | Least-privilege roles for Lambda + identity-pool roles | `aws_iam_role`, `aws_iam_policy`, attachments |
| **CloudWatch Logs** | Lambda / API Gateway logs | `aws_cloudwatch_log_group` |

> CloudFront sits in front of Amplify Hosting but is managed by Amplify, not authored directly.

### Remote state
- Backend is an **S3 bucket** (versioned + SSE-encrypted) holding `terraform.tfstate`.
- **State locking** uses S3 native locking (`use_lockfile = true`, Terraform ≥ 1.10); a DynamoDB lock table is an optional alternative for older versions.
- **Bootstrap ordering:** the state bucket must exist before the `backend "s3"` block can use it — create it via a one-time bootstrap (local state, then `terraform init -migrate-state`) or a separate bootstrap module.

### Environments
- Separate state/config per environment (`staging`, `prod`) via distinct backend keys (or workspaces) and `*.tfvars`.
- Secrets are set per environment in SSM; `amplify_outputs.json` does **not** exist in this architecture — the frontend reads Cognito/API config from Amplify Hosting environment variables (or a generated runtime config), populated from Terraform outputs.

---

## 3. Data model (DynamoDB, tables provisioned via Terraform)

Two DynamoDB tables (`aws_dynamodb_table`), accessed by Lambda functions through the AWS SDK. Stored as JSON documents.

### Trip
| Field | Type | Notes |
|---|---|---|
| `id` | ID | auto |
| `name` | String | trip name |
| `location` | String | free text / display label |
| `tripType` | Enum | e.g. `ROAD_TRIP` \| `CITY` \| `BEACH` \| `MOUNTAIN` \| `FOOD` \| `CAMPING` \| `OTHER` — for grouping/filter |
| `city` | String | structured, for filter/group |
| `province` | String | structured, for filter/group |
| `country` | String | structured, for filter/group |
| `durationDays` | Integer | trip duration in days |
| `vehicle` | Enum | `MOTORBIKE` \| `CAR` \| `BICYCLE` \| `OTHER` |
| `thumbnailKey` | String | S3 object key |
| `myMapsUrl` | String | user-pasted My Maps link (validated) |
| `googleMapsUrl` | String | optional "start journey" destination link |
| `authorId` | String | Cognito user sub |
| `authorName` | String | display name |
| `createdAt` | AWSDateTime | auto |
| `favoriteCount` | Integer | denormalized counter for cards |

> **Search & filter note:** `name`, `location`, `city`, `province`, and `country` are the fields the search bar and group/filter controls operate on. DynamoDB alone isn't great at free-text search across fields, so see §4a for the search strategy.

### Favorite
| Field | Type | Notes |
|---|---|---|
| `id` | ID | auto |
| `tripId` | ID | FK to Trip |
| `userId` | String | Cognito sub |
| `createdAt` | AWSDateTime | auto |

Composite uniqueness on (`tripId`, `userId`) prevents double-favoriting; secondary index on `userId` powers "my favorites".

### Authorization model
There is no AppSync/Amplify field-level auth. Authorization is enforced in two layers:
- **API Gateway JWT authorizer** (Cognito User Pool) gates all mutating routes (`POST/PUT/DELETE /trips`, `/favorites`); read routes (`GET /trips`, `GET /trips/{id}`) are public/unauthenticated.
- **Application-level checks in Lambda**: `Trip` create/update/delete require the caller's Cognito `sub` to equal `authorId`; `Favorite` read/create/delete require the caller's `sub` to equal `userId`. Lambda IAM roles scope DynamoDB/S3 access to least privilege.
- **Guests** (unauthenticated) read public trips through the public GET routes; the Cognito **Identity Pool** unauthenticated role is used only where temporary AWS credentials are needed (e.g. direct S3 reads, if any).

---

## 3a. Search, filter & grouping strategy

The search bar and the group/filter controls need to query across `name`, `location`, `city`, `province`, `country`, `tripType`, and `vehicle`. Two viable approaches — pick based on scale:

**Option A — DynamoDB only (start here, simplest & cheapest).**
- **Filter / group by** `tripType`, `country`, `province`, `city`, `vehicle`: use secondary indexes (GSIs) so each is an efficient query, and group results client-side or per-query.
- **Search bar**: for a small/medium dataset, fetch the candidate set and do case-insensitive substring matching on the client, or use a `contains` filter expression server-side. This is fine for a launch-scale app and keeps cost near zero (matches your lean-infra preference).

**Option B — Dedicated search service (only if the dataset grows large).**
- Add OpenSearch (or an external search SaaS) fed from DynamoDB streams for true full-text search and typo tolerance. Heavier and more expensive — defer until Option A actually hurts.

**Recommendation:** ship with Option A. The structured `city`/`province`/`country`/`tripType` fields make filtering and grouping clean without any extra service. Revisit Option B only if search quality or volume demands it.

---

## 4. Key screens

1. **Home / Discover** — responsive grid of trip cards (thumbnail, name, location, duration, vehicle icon, author, heart + count). Public. Includes:
   - **Search bar** at the top — searches name/location/city/province/country.
   - **Filter & group controls** — by trip type, country, province, city, and vehicle. Results can be grouped under headers (e.g. by country) or shown as a flat filtered grid.
   - **AI suggestion entry** — a prompt/search box ("Where do you want to ride?") that calls the Gemini-backed suggestion flow and returns recommended trip cards.
2. **AI suggestions results** — cards suggested by Gemini based on the user's prompt, with a short "why this fits" note per trip (optional). Can live inline on Home or as a dedicated view.
3. **Trip detail popup (modal)** — full info + embedded My Maps iframe + "Open in Google Maps" button + heart.
4. **Create / Edit trip** — form with thumbnail upload, structured location fields (city/province/country), trip type + vehicle pickers, My Maps URL field with validation/help text. Auth required.
5. **My trips** — trips the user has created. Auth required.
6. **Saved / Favorited trips** — the trips the user has hearted, in their own view. Auth required.
7. **Auth** — "Sign in with Google" via Cognito Hosted UI or Amplify Authenticator.

---

## 5. Development plan (milestones)

### M0 — Project & Terraform setup (1–2 days)
- Use **pnpm** as the package manager (commit `pnpm-lock.yaml`).
- Scaffold a Next.js App Router app (`pnpm create next-app`).
- **Terraform bootstrap:** create the S3 state-backend bucket (versioned + encrypted) and configure the `backend "s3"` block (native S3 state locking via `use_lockfile`; a DynamoDB lock table is an optional alternative). Resolve the bootstrap ordering (state bucket created with local state first, then migrated, or via a separate bootstrap module).
- Lay out the `infra/` Terraform: modules per concern (`network`-free serverless, `cognito`, `dynamodb`, `s3`, `lambda`, `apigateway`, `hosting`), and per-environment configs for `staging` and `prod`.
- Provision **Amplify Hosting** (`aws_amplify_app` + `aws_amplify_branch` for `main`/`staging`) connected to the GitHub repo, with a pnpm-based build spec.

### M1 — Auth (1–2 days)
- Terraform-provision **Cognito**: User Pool, User Pool Client, Hosted UI domain, Google identity provider (`aws_cognito_identity_provider`), and an Identity Pool with authenticated/unauthenticated IAM roles for guest access.
- Set up Google OAuth client in Google Cloud Console (consent screen, redirect URIs pointing at the Cognito Hosted UI domain per environment).
- Configure Amplify JS Auth on the client to point at the Terraform-created Cognito pool; sign-in / sign-out flow; guest (unauthenticated) browsing.

### M2 — Data + storage (1–2 days)
- Terraform-provision the `Trip` and `Favorite` **DynamoDB tables** with GSIs (pay-per-request).
- Terraform-provision the **S3 thumbnails bucket** (private; CORS for browser PUT/GET). Uploads use **presigned URLs** issued by a Lambda; reads use presigned GET (or public-read CDN later).
- Define the base **API Gateway (HTTP API)** + a Cognito **JWT authorizer**, and Lambda IAM roles scoped to the tables/bucket.

### M3 — Core trip CRUD (2–3 days)
- Trip CRUD **Lambda(s)** behind API Gateway routes (`GET/POST /trips`, `GET/PUT/DELETE /trips/{id}`) reading/writing the DynamoDB table via the AWS SDK.
- Create/edit trip form, including thumbnail upload (presigned-URL flow), structured location fields (city/province/country), trip type + vehicle pickers, and My Maps URL validation.
- List + card grid (mobile-first responsive layout).
- "My trips" view.

### M4 — Social features (2 days)
- Heart-to-favorite with optimistic UI; favorite count.
- **Saved / Favorited trips** view (the user's hearted trips).
- Public share URL per trip (`/trip/[id]`).

### M5 — Search, filter & grouping (2–3 days)
- Search bar over name/location/city/province/country (Option A: DynamoDB + client/contains matching).
- Filter and group controls by trip type, country, province, city, vehicle (backed by GSIs).
- Empty-state and "no results" handling.

### M6 — AI trip suggestions with Gemini (2–3 days)
- Lambda (`suggestTrips`) behind an API Gateway route (`POST /suggest`) that takes the user's prompt + a candidate trip set, calls the Gemini API server-side, and returns ranked/suggested trip IDs (with optional "why it fits" notes).
- Gemini API key stored in **SSM Parameter Store (SecureString)** or Secrets Manager, read by the Lambda at runtime; never exposed to the browser.
- Prompt UI on Home; render suggested cards; graceful fallback to plain search if the AI call fails.

### M7 — Maps integration (1–2 days)
- Detail popup with embedded My Maps iframe (with safe-URL guard).
- "Open in Google Maps" deep-link button; mobile handoff tested on iOS + Android.

### M8 — Polish + deploy (2–3 days)
- Responsive QA across device sizes; empty/loading/error states.
- Form validation, image size limits, basic rate sanity.
- `terraform apply` the `prod` environment; deploy `main` via Amplify Hosting; smoke test the full flow.

**Rough total: ~3–4 weeks of focused solo work.**

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Users paste a non–My Maps or malformed URL | Validate URL host/pattern on submit; show inline help with an example; sanitize before iframe embed |
| My Maps iframe blocked / private map | Detect load failure; fall back to a plain "Open map" link |
| Deep link opens browser instead of native app | Documented platform behavior; treat native handoff as best-effort, not guaranteed |
| Public write abuse (spam trips) | Auth required to create; consider lightweight moderation/report later |
| S3 thumbnail cost/size creep | Enforce max upload size + image type; resize on upload if needed |
| Cognito + Next.js SSR session handling | Use the official `@aws-amplify/adapter-nextjs` patterns (Amplify JS Auth pointed at the Terraform-created Cognito pool) for server-side auth |
| Gemini API key leakage | Call Gemini only from Lambda/server; store key in SSM/Secrets Manager; never ship it to the browser |
| Terraform state corruption / loss | Versioned, encrypted S3 backend; native state locking (`use_lockfile`); never edit state by hand |
| Bootstrap ordering (state bucket vs backend) | Create the state bucket in a separate bootstrap step before configuring the `backend "s3"` block |
| Drift between Terraform and console changes | Treat Terraform as the single source of truth; avoid manual console edits; run `terraform plan` in CI |
| Gemini suggests trips that don't exist | Constrain Gemini to rank/select only from the candidate trip IDs you pass it; validate returned IDs against DynamoDB before rendering |
| Gemini latency or cost on every keystroke | Trigger AI suggestion on explicit submit (not per-keystroke); keep plain search instant and separate |
| Inconsistent location data hurts filtering | Use dropdowns/autocomplete for country/province where possible, or normalize on save |

---

## 7. Open questions for later
- Should AI suggestions also factor in the user's favorited trips / history (personalization)?
- Comments or ratings on trips?
- PWA / installability as a phase 2?
- Thumbnail auto-generation if user skips upload?
- Move to OpenSearch (search Option B) if dataset/search volume grows?
