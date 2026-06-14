# Project Architecture Blueprint — road-rash

**Generated:** 2026-06-15
**Scope:** Whole-repository architectural reference, derived from the code on disk (not from plan documents).
**Companion docs:** [`architecture.md`](architecture.md) (narrative architecture), [`road-rash-plan.md`](road-rash-plan.md) (product plan), [`plan/feature-road-rash-mvp-1.md`](plan/feature-road-rash-mvp-1.md) (task ledger).

> This blueprint is a **maintenance reference**: it documents the patterns actually present in the codebase so new work stays consistent with them. Where the implementation diverges from the older `architecture.md` draft (dated pre-implementation), this document reflects the **code**.

---

## 1. Architecture Detection & Technology Stack

| Layer | Technology (from `package.json`, `*.tf`, source) | Role |
|---|---|---|
| Frontend framework | **Next.js 16** (App Router, SSR), **React 19** | Server-rendered pages + client islands |
| Language | **TypeScript 5** (strict), Node ≥ 24 | Shared across web + Lambdas |
| Styling/UI | **Tailwind CSS 4**, `class-variance-authority`, `clsx`, `lucide-react`, local shadcn-style `components/ui/*` | Design system |
| Auth (client) | **aws-amplify 6** + `@aws-amplify/adapter-nextjs` | Cognito sessions (browser + SSR) |
| Backend compute | **AWS Lambda** (Node, AWS SDK v3), bundled with **esbuild** | REST handlers |
| API edge | **API Gateway HTTP API (v2)** + Cognito JWT authorizer | Routing, authz, throttling, CORS |
| Data | **DynamoDB** (on-demand) — `Trip` + `Favorite` tables | Persistence |
| Media | **S3** + presigned PUT/GET | Thumbnails |
| AI | **Google Gemini** (`generativelanguage.googleapis.com`) | Trip ranking |
| Secrets | **SSM Parameter Store** (SecureString) | Gemini key |
| IaC | **Terraform** (S3 remote state, `use_lockfile`), modular | All AWS resources |
| Hosting/CI | **AWS Amplify Hosting** + **GitHub Actions** (OIDC, no static keys) | Build/deploy |
| Test | **Vitest** | Unit tests co-located as `*.test.ts` |

**Architectural style:** **Serverless, REST-over-HTTP, function-per-bounded-route**, with a **server-rendered web client** and **infrastructure-as-code** as a first-class subsystem. There is **no GraphQL/AppSync and no Amplify Gen 2 backend** — Amplify is hosting only.

### The defining constraint (drives everything)

**Google My Maps has no public API.** A trip's map is *user-supplied data*: the user builds the map by hand, pastes the share URL, and the app validates → stores the string → renders it as a read-only `<iframe>`. `lib/validation.ts` is the security spine of this constraint (host + `/maps/d/` path + `mid` allow-list). No feature assumes programmatic map access.

---

## 2. Architectural Overview

Three independently-deployable subsystems share one TypeScript domain model (`lib/types.ts`):

1. **Web app** (`app/`, `components/`, `lib/`) — Next.js SSR. Public pages fetch trips server-side; client "islands" (`TripBrowser`, `FavoritesProvider`) add interactivity. Talks only to the REST API.
2. **Serverless backend** (`services/`) — four Lambdas (`trips`, `favorites`, `presign`, `suggest-trips`) behind one HTTP API. Each owns one route group; shared helpers in `services/shared/`.
3. **Infrastructure** (`infra/`) — Terraform modules compose per-environment roots (`staging`, `prod`). Terraform is the single source of truth for every AWS resource.

**Guiding principles evident in the code:**
- **Public-read, authenticated-write.** GET routes are open; mutations require a Cognito JWT.
- **Two-layer authorization** (edge authorizer + in-handler ownership check) — not a schema/policy engine.
- **Least privilege per function** — each Lambda gets its own IAM role naming specific ARNs.
- **Denormalize, don't recompute** — `Trip.favoriteCount` is a counter, never a scan.
- **Validate at every trust boundary** — body validation, URL allow-list, AI-id re-validation.
- **Graceful degradation** — AI failure falls back to plain search; missing API config renders an empty shell, not a crash.
- **Shared domain types** — one `lib/types.ts` imported by both web (`@/lib/types`) and Lambdas (relative).

---

## 3. Architecture Visualization

> Rendered **Mermaid** versions of these (AWS resources, request/auth flow, AI flow, data model, CI/CD) live in [`architecture-diagrams.md`](architecture-diagrams.md). The ASCII views below are the quick-reference inline copies.

### 3.1 System context (C4 L1)

```
   Guest ─────────────┐                 ┌───────────── Authenticated author
   (browse/search)    ▼                 ▼   (create/edit/favorite)
                ┌───────────────────────────────────┐
                │   road-rash web app (Next.js SSR)  │
                │      AWS Amplify Hosting           │
                └───┬──────────┬───────────┬─────────┘
       Google OAuth │  My Maps │  REST API │  (browser → S3 presigned PUT)
       (Cognito idP)│  iframe  │           │
                    ▼          ▼           ▼
              ┌─────────┐  ┌────────┐  ┌──────────────────────────────┐
              │ Cognito │  │ Google │  │  API Gateway (HTTP API)       │
              │  (+Google│ │ My Maps│  │  → Lambda → DynamoDB / S3      │
              │  OAuth) │  └────────┘  │  suggest → Gemini + SSM       │
              └─────────┘              └──────────────────────────────┘
```

### 3.2 Container / component view (C4 L2)

```
┌──────────────────────────── Web (Next.js) ─────────────────────────────┐
│  app/ (RSC pages, force-dynamic)                                        │
│   page.tsx ── api.getTrips() ──► TripBrowser (client island)           │
│   trip/[id], trips/new|edit, my-trips, saved, login                    │
│  layout.tsx → ConfigureAmplifyClientSide + ThemeProvider + Favorites   │
│  lib/ : api-client (typed fetch), amplify-config, server-session,      │
│         search, validation, types, use-infinite-scroll                  │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ HTTPS + Bearer (Cognito ID token) / public GET
                ▼
┌──────────────────────── API Gateway (HTTP API v2) ─────────────────────┐
│  CORS · default throttle · JWT authorizer (Cognito)                     │
│  per-route throttle override: POST /suggest (5/2), POST /trips (10/5)   │
└───┬───────────────┬───────────────┬────────────────────┬────────────────┘
    │ AWS_PROXY     │               │                    │
    ▼               ▼               ▼                    ▼
┌────────┐    ┌───────────┐    ┌──────────┐       ┌───────────────┐
│ trips  │    │ favorites │    │ presign  │       │ suggest-trips │
│ Lambda │    │  Lambda   │    │  Lambda  │       │    Lambda     │
└───┬────┘    └────┬──────┘    └────┬─────┘       └──────┬────────┘
    │ Trip CRUD    │ Fav CRUD       │ S3 presign         │ Trip read-only
    │ + Query/Scan │ + Trip.Update  │ (PUT/GET)          │ + SSM GetParameter
    ▼              ▼ (count only)   ▼                    ▼        ▼
┌────────────┐ ┌────────────┐  ┌─────────┐        ┌────────┐ ┌──────────┐
│ Trip table │ │ Favorite   │  │ S3       │        │ Gemini │ │ SSM      │
│ (5 GSIs)   │ │ (userId GSI)│ │ bucket   │        │  API   │ │ (key)    │
└────────────┘ └────────────┘  └─────────┘        └────────┘ └──────────┘
```

### 3.3 Shared-helper dependency direction (`services/`)

```
handler.ts (per service) ──► shared/http.ts   (json/error/noContent)
                          ──► shared/auth.ts   (getUserSub/getDisplayName from JWT claims)
                          ──► shared/dynamo.ts (singleton DocumentClient)
                          ──► <service>/validate.ts | select.ts | count.ts (pure, unit-tested)
                          ──► ../../lib/types  (shared domain model)
```
Dependencies point **inward toward stateless, pure helpers**; no helper imports a handler.

---

## 4. Core Architectural Components

### 4.1 `trips` Lambda — `services/trips/handler.ts`
- **Responsibility:** Trip CRUD + search/filter/group (`GET /trips`, `GET /trips/{id}`, `POST/PUT/DELETE /trips/{id}`).
- **Structure:** Single `handler` routes on `event.routeKey`; one async function per operation; `parseTripQuery` / `buildFilterExpression` build the DynamoDB query.
- **Notable patterns:** GSI **Query when an exact-match filter is present, else Scan** (most→least selective ordering); the chosen filter becomes the key condition, the rest fall through to a `FilterExpression`. Server-owned fields (`id`, `authorId`, `authorName`, `favoriteCount`, timestamps) are **set by the server**, never trusted from the client. `MAX_TRIPS = 200` defensive cap.
- **Extension point:** add a filter dimension → add a GSI (dynamodb module) + an entry in `GSI_FILTERS`/`SEARCHABLE_FIELDS` + mirror in `lib/search.ts`.

### 4.2 `favorites` Lambda — `services/favorites/handler.ts`
- **Responsibility:** favorite/unfavorite + saved list, **all JWT-gated**, keyed by the caller's verified `sub`.
- **Notable patterns:** **Conditional `PutItem` (`attribute_not_exists`) for dedupe**; **conditional `DeleteItem` (`attribute_exists`)** so a no-op delete can't over-decrement. The denormalized `Trip.favoriteCount` is nudged with a **guarded atomic `UpdateItem`** (`buildFavoriteCountUpdate`, floored at 0). Idempotent from the client's perspective. **Known trade-off (RISK-005):** counter and row are two writes → possible drift; reconciled out-of-band by `scripts/reconcile-favorites.ts`.

### 4.3 `presign` Lambda — `services/presign/handler.ts`
- **Responsibility:** issue **short-lived presigned S3 URLs** — `POST /uploads/presign` (JWT, 5-min PUT) and `GET /uploads/thumbnail` (public, 1-hr GET).
- **Notable patterns:** content-type allow-list + size cap enforced server-side (`SEC-004`); upload key is **caller-scoped** `thumbnails/<sub>/<uuid>.<ext>`; GET signing refuses any key outside the prefix.

### 4.4 `suggest-trips` Lambda — `services/suggest-trips/handler.ts`
- **Responsibility:** AI ranking (`POST /suggest`, public but hard-throttled).
- **Notable patterns:** **Gemini is server-side only** — key read from SSM at runtime, cached per cold start, sent in a header (not query string). The model ranks **only ids from the client-supplied candidate set**; output is parsed → filtered to the candidate set → capped → **re-validated against DynamoDB** before return (`GetItem` per id; role lacks `Scan`/`BatchGetItem`). **`AbortController` timeout** under the API Gateway 30s ceiling; any failure returns 502 so the client falls back to plain search.

### 4.5 Web client islands
- **`TripBrowser`** (`components/TripBrowser.tsx`) — discovery shell. Instant client-side search/filter/group over the SSR-loaded set (`lib/search.ts`); "Ask AI" submits the same text to `/suggest`. Uses a **monotonic `requestIdRef`** to discard superseded async AI responses, and falls back to `filterTrips` on AI error.
- **`FavoritesProvider`** (`components/FavoritesProvider.tsx`) — app-wide context. Loads favorites once on mount (avoids N per-card requests), **optimistic toggle** with revert-on-error, tracks a `countDelta` layered on each trip's stored `favoriteCount`, and re-loads on the Amplify `Hub` `signedIn`/`signInWithRedirect` events (OAuth lands on `/` mid-token-exchange).

---

## 5. Architectural Layers & Dependency Rules

```
┌─ Presentation ── app/*, components/*            (RSC + client islands)
│      depends on ▼
├─ Client domain ─ lib/* (api-client, search, validation, types, session)
│      crosses the network ▼ (typed fetch, JWT)
├─ Edge ────────── API Gateway (authz, throttle, CORS, route→Lambda)
│      AWS_PROXY ▼
├─ Application ─── services/<svc>/handler.ts      (routing + orchestration)
│      depends on ▼
├─ Service helpers services/shared/* + <svc>/{validate,select,count}.ts (pure)
│      depends on ▼
└─ Data ───────── DynamoDB / S3 / SSM / Gemini    (via AWS SDK v3 / fetch)
```

**Rules observed in code:**
- Handlers depend on shared helpers and pure per-service modules — **never the reverse**.
- `lib/types.ts` is the **only module imported across the web/Lambda boundary** and is deliberately dependency-free so it bundles into both.
- The web client reaches data **only** through `lib/api-client.ts` (single network choke point); no component calls `fetch` against AWS directly except the browser→S3 presigned PUT.
- Server-only code (`lib/server-session.ts`) is fenced with `import "server-only"`; client config (`amplify-config.ts`) guards `Amplify.configure` behind `typeof window !== "undefined"`.

---

## 6. Data Architecture

**Domain model:** `lib/types.ts` defines `Trip`, `TripInput` (client-submittable subset — server fields excluded so authorId can't be spoofed), and the AI shapes (`SuggestCandidate`/`SuggestRequest`/`SuggestionResult`). Enums (`TRIP_TYPES`, `VEHICLES`) are `as const` tuples that double as runtime allow-lists.

**Tables** (`infra/modules/dynamodb`, both `PAY_PER_REQUEST`):

| Table | Key | Indexes | Notes |
|---|---|---|---|
| `Trip` | `id` (HASH) | 5 GSIs: `country`, `province`, `city`, `tripType`, `vehicle` (all `ALL` projection) | GSIs back filter/group; card grid renders from a single Query. `favoriteCount` is a plain denormalized attr. |
| `Favorite` | `tripId` (HASH) + `userId` (RANGE) | `userId-index` (GSI, `KEYS_ONLY`) | Composite key = one favorite per (trip,user). GSI backs the saved-trips view (returns tripIds → hydrate client-side). |

**Access patterns:**
- Repository logic lives **inline in handlers** via the shared `ddb` DocumentClient (`removeUndefinedValues` lets optional fields pass as `undefined`) — there is no separate repository class layer.
- **Read-time joins are avoided**: counts are denormalized; the saved view returns ids and hydrates from already-loaded trips.
- **Validation:** `validateTripInput` / `validateFavoriteInput` (per-service, unit-tested) gate every write; `validateMyMapsUrl` gates the iframe src.

---

## 7. Cross-Cutting Concerns

### Authentication & Authorization (two layers)
1. **Edge:** API Gateway **Cognito JWT authorizer** (`infra/modules/apigateway`) gates mutating routes via `authorization_type = JWT`; public GET routes set `NONE`.
2. **Handler:** ownership is enforced in code — `getUserSub(event)` reads the verified `sub` claim and is compared to `authorId`/`userId` before any edit/delete (`services/shared/auth.ts`, `PAT-002`). The favorite is *keyed* by `sub`, so a user can only ever touch their own.

Client sessions: Amplify configured **manually** (no `amplify_outputs.json`) from `NEXT_PUBLIC_*` Terraform outputs; SSR reads cookies through `createServerRunner`'s isolated per-request context (`lib/amplify-server-utils.ts`), never the global singleton.

### Error handling & resilience
- Every handler wraps its switch in `try/catch` → `error(500, ...)` and `console.error`. Helper `http.ts` standardizes `{ message }` bodies.
- `api-client.ts` parses defensively (non-JSON error pages won't throw `SyntaxError`) and raises a typed `ApiError(status, message, body)`.
- AI path: timeout + 502 → client falls back to plain search. Missing API config → page renders empty shell. Favorite counter failure on a deleted trip is swallowed (row stays source of truth).

### Logging & monitoring
- `console.*` → CloudWatch; IAM grants are scoped to the project/env Lambda log-group prefix only.

### Configuration & secrets
- **Browser-safe config** flows Terraform outputs → Amplify env vars (`NEXT_PUBLIC_*`) — see `amplify_environment_variables` in `infra/envs/*/main.tf`. **Never secrets.**
- **Secrets** (Gemini key) live in SSM SecureString, read by ARN at runtime; the Terraform module ignores value changes after first apply.
- Lambda env vars carry only **names** (table/bucket/parameter), never secret values.

---

## 8. Service Communication Patterns

- **Browser ↔ API:** HTTPS REST/JSON; **Cognito ID token as `Authorization: Bearer`** on protected calls (tokens in header, not cookies → CORS `credentials` off). Single client: `lib/api-client.ts`.
- **Browser → S3:** direct **presigned PUT** for uploads (offloads bytes from Lambda); presigned GET for rendering.
- **API Gateway → Lambda:** `AWS_PROXY`, payload format **2.0**, integration method always `POST`. One `aws_lambda_permission` per integration scoped to `<api-execution-arn>/*/*`.
- **Lambda → AWS:** AWS SDK v3 with per-function least-privilege roles.
- **Lambda → Gemini:** outbound `fetch` with `AbortController`.
- **No async/event bus, no service-to-service calls** — each Lambda is a leaf that talks only to data stores. (A DynamoDB-stream reconciler for `favoriteCount` is deferred.)
- **Versioning:** none yet — single unversioned stage (`$default`, clean base URL).

---

## 9. Technology-Specific Patterns

### Next.js (App Router)
- Pages are **React Server Components**; data fetched server-side (`app/page.tsx` → `api.getTrips()`), with `export const dynamic = "force-dynamic"` for always-fresh SSR.
- **Client islands** (`"use client"`) for interactivity; providers (`Favorites`, `Theme`, Amplify config) mounted once in `layout.tsx`.
- SSR auth via `@aws-amplify/adapter-nextjs` `createServerRunner`; server-only modules fenced with `import "server-only"`.
- `@/*` path alias maps the shared domain types into the web build.

### Lambda (Node, SDK v3)
- One handler per service, routed on `routeKey`; **clients instantiated once per cold start** and reused (`shared/dynamo.ts`, module-scope `s3`/`ssm`).
- Bundled by `services/build.mjs` (esbuild, CJS, `node22`), **`@aws-sdk/*` marked external** (provided by the runtime). Output `dist/index.js` is gitignored and zipped by Terraform — **`pnpm build:lambdas` must run before `terraform plan/apply`.**

### Terraform
- **Module-per-concern** (`cognito`, `dynamodb`, `s3`, `lambda`, `apigateway`, `hosting`, `iam`, `ssm`, `github-oidc`); env roots (`staging`/`prod`) compose them; `bootstrap` provisions the state bucket.
- `for_each`-driven routes/integrations/throttles keep the API declarative and data-shaped.
- Remote state in S3 with native locking (`use_lockfile`); CI runs `fmt -check -recursive`, per-root `validate -backend=false`, and tflint.

---

## 10. Implementation Patterns (templates)

**New protected route handler operation:**
```ts
async function doThing(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const sub = getUserSub(event);
  if (!sub) return error(401, "Unauthenticated");          // layer-1 already gated; defensive
  const v = validateThingInput(parseBody(event.body));
  if (!v.ok) return error(400, v.message);                 // validate at the boundary
  const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  if (!existing.Item) return error(404, "Not found");
  if ((existing.Item as Trip).authorId !== sub) return error(403, "Not the owner"); // layer-2 ownership
  /* ...mutate, preserving server-owned fields... */
  return json(200, updated);
}
```

**New typed client method (`lib/api-client.ts`):** add to the `api` object; set `auth: true` for protected routes; SSR callers pass a pre-fetched `token`.

**Pure, testable module:** put logic with no AWS dependency in `<svc>/{validate,select,count}.ts` (or `lib/search.ts`) + a co-located `*.test.ts`. Handlers stay thin orchestrators.

---

## 11. Testing Architecture
- **Vitest**, unit-focused, tests co-located as `*.test.ts` next to source (`lib/search.test.ts`, `services/suggest-trips/select.test.ts`, `services/favorites/count.test.ts`, `scripts/reconcile-favorites.test.ts`).
- Strategy = **extract pure functions, test those**; handlers are kept thin so most logic is testable without AWS. No live AWS in tests.
- **Current verification gates:** `pnpm test`, `pnpm build` (runs `tsc`), `pnpm lint`, `pnpm format:check`. Terraform: `fmt`/`validate`/`tflint`. (Stack is `validate`-clean but **not yet `apply`-ed** — end-to-end AWS paths can't be exercised locally yet.)

---

## 12. Deployment Architecture
- **Frontend:** Amplify Hosting builds via `amplify.yml` (forces **pnpm via Corepack**, `pnpm install --frozen-lockfile` → `pnpm build`, artifacts `.next`).
- **CI/CD (GitHub Actions):**
  - `nextjs-ci.yaml` — PR gate: lint, format:check, build, test.
  - `tf-ci.yaml` — PR gate on `infra/**`: fmt/validate/tflint, no AWS creds.
  - `deploy.yaml` — push to `main` → verify gate → Terraform verify → **`build:lambdas` + `terraform apply` staging** → Amplify RELEASE. Serialized (`concurrency: deploy-staging`), assumes an **OIDC role (no static keys)**.
- **Environments:** `staging` is the only live target today; `prod` root exists but isn't deployed. Region `ap-southeast-1`.
- **Config flow:** Terraform outputs → Amplify env vars → `NEXT_PUBLIC_*` at build/runtime.

---

## 13. Extension & Evolution Patterns

| To add… | Do this |
|---|---|
| A new searchable/filterable field | Add a GSI in `dynamodb` module → extend `GSI_FILTERS`/`SEARCHABLE_FIELDS` (trips handler) → mirror in `lib/search.ts` → add `TripFilters` key. |
| A new route on an existing service | Add a `case` in the handler switch + a `routes` entry (and any throttle) in the env `apigateway` block + an `api` client method. |
| A new service (Lambda) | Scaffold `services/<name>/handler.ts` (+ pure helpers + tests) → add to `services/build.mjs` list → add an IAM role (iam module) → `module "lambda_<name>"` + integration/routes in env root. |
| A new external integration | Read secrets from SSM by ARN (never env/Terraform values); grant the single parameter in that function's role; wrap calls with a timeout + fallback. |
| `favoriteCount` accuracy at scale | Replace the two-write nudge with a **DynamoDB-stream reconciler** (the deferred fix); `scripts/reconcile-favorites.ts` is the interim. |

**Anti-corruption boundaries already in place:** the My Maps URL allow-list (`validation.ts`), the AI candidate-set + DB re-validation (`suggest-trips`), and `TripInput` excluding server-owned fields.

---

## 14. Architectural Decision Records (inferred from code)

| Decision | Rationale (in code/comments) | Consequence |
|---|---|---|
| **REST + Lambda, not GraphQL/AppSync** | Simplicity, cost, no schema engine | Hand-rolled routing on `routeKey`; authz in two explicit layers |
| **Terraform owns all AWS; Amplify hosting-only** | Single source of truth, reproducible | No console drift; `apply` deferred until needed |
| **DynamoDB-only search (Option A)** | Small launch dataset, avoid OpenSearch cost | GSI Query + `contains`, client-side authoritative substring; revisit at scale |
| **Denormalized `favoriteCount`** (`GUD-003`) | Avoid read-time scans of Favorite | Two-write drift risk (`RISK-005`), reconciler deferred |
| **My Maps as user-supplied iframe data** (`CON-001`) | No My Maps API exists | Strict URL allow-list is the security spine |
| **Gemini server-side only, candidate-bounded** (`SEC-001`/`RISK-007`) | Protect key + cost, prevent hallucinated ids | SSM key, header transport, DB re-validation, hard throttle |
| **Manual Amplify config (no `amplify_outputs.json`)** | Decouple from Amplify Gen 2 | Wire `NEXT_PUBLIC_*` from Terraform; SSR via `createServerRunner` |
| **Per-function least-privilege IAM** (`SEC-005`) | Blast-radius containment | favorites role: Favorite CRUD + `UpdateItem`-only on Trip; suggest role: read-only |
| **esbuild bundles, SDK external** | Small zips, runtime-provided SDK | Must `build:lambdas` before any plan/apply |

---

## 15. Architecture Governance
- **PR gates** enforce consistency: Next.js CI (lint/format/build/test) and Terraform CI (fmt/validate/tflint) must pass before merge.
- **CLAUDE.md / AGENTS.md** encode locked decisions; `docs/plan/feature-road-rash-mvp-1.md` is the authoritative task ledger (keep `Completed`/`Date` current).
- **Single choke points** make violations visible: all client data access via `lib/api-client.ts`; all domain shape via `lib/types.ts`; all AWS via Terraform modules.
- **Reconciliation tooling** (`scripts/reconcile-favorites.ts`) compensates for the one accepted consistency trade-off.

---

## 16. Blueprint for New Development

**Workflow by feature type:**
- *New public read* → RSC page fetching via `api.*` (public route) → hand data to a client island for interactivity.
- *New mutation* → validate input (pure module + test) → handler op (`getUserSub` → validate → ownership → mutate, preserving server fields) → route + throttle in env root → typed `api` method (`auth: true`).
- *New infra* → module-per-concern, compose in env roots, scope IAM to exact ARNs, surface only non-secret outputs to `NEXT_PUBLIC_*`.

**Common pitfalls to avoid:**
- Forgetting `pnpm build:lambdas` before `terraform plan/apply` (zips stale/empty `dist/`).
- Putting a secret in `amplify_environment_variables` / `NEXT_PUBLIC_*` (those reach the browser).
- Trusting client-supplied `authorId`/`favoriteCount`/AI ids — always server-set / re-validated.
- Computing `favoriteCount` by scanning Favorite (it's denormalized).
- Calling `Amplify.configure` or reading the session via the global singleton on the server (use `createServerRunner`).
- Accepting any non-My-Maps URL into the iframe (must pass `validateMyMapsUrl`).

---

### Keeping this blueprint current
Regenerate after changes to: the route map (`infra/envs/*/main.tf` + handler switches), the data model (`lib/types.ts`, `dynamodb` module), the IAM roles (`iam` module), or the auth flow. This document was generated from the codebase on **2026-06-15**; treat the code and `docs/plan/feature-road-rash-mvp-1.md` as the tiebreakers when they disagree with prose.
