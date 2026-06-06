# road-rash — Architecture & Development Plan

A mobile-oriented web app for creating, sharing, and discovering travel trip plans, built around Google My Maps and Google Maps.

**Stack:** Next.js · AWS Amplify Gen 2 (Cognito, AppSync/GraphQL, DynamoDB, S3, Lambda) · Google OAuth · Google Gemini (AI trip suggestions)
**Package manager:** pnpm
**Last updated:** 2026-06-06

---

## 1. Locked decisions

| Question | Decision |
|---|---|
| Thumbnails | Upload images to S3 (Amplify Storage) |
| Mobile-oriented | Responsive web only (not a PWA, for now) |
| Trip browsing | Public — anyone can browse shared trips |
| My Maps link in detail popup | Embedded iframe preview |

### The key architectural constraint
Google My Maps has **no public API**. The app cannot create, edit, or read a My Maps map programmatically. The "My Maps link" on a trip is therefore **user-supplied data**: the user creates their map manually in the My Maps UI and pastes the share/embed URL into the trip form. The app stores the string, validates it, and renders it as an embedded iframe. The "open in Google Maps" action is a separate, reliable mobile deep-link handoff.

---

## 2. System architecture

```
                        ┌─────────────────────────────┐
                        │   Browser (mobile-first)    │
                        │   Next.js App Router (SSR)  │
                        └──────────────┬──────────────┘
                                       │
                  ┌────────────────────┼────────────────────┐
                  │                    │                    │
          ┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
          │ Amplify Hosting│  │   AppSync       │  │   S3 (Storage)  │
          │ (Next.js SSR)  │  │  GraphQL API    │  │  trip thumbnails│
          └────────────────┘  └────┬───────┬────┘  └─────────────────┘
                                    │       │
                         ┌──────────▼──┐ ┌──▼──────────┐
                         │  DynamoDB   │ │  Cognito    │
                         │ Trip /      │ │ User Pool   │
                         │ Favorite    │ │ + Google    │
                         │ tables      │ │ federation  │
                         └─────────────┘ └─────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  Google OAuth     │
                                    │  (Identity Prov.) │
                                    └───────────────────┘

   AI suggestion flow (separate path):
   Browser ──prompt──▶ AppSync custom query / API route
                          │
                   ┌──────▼───────┐      ┌──────────────┐
                   │ Lambda       │─────▶│ Google Gemini│
                   │ "suggestTrips"│◀────│ API          │
                   └──────┬───────┘      └──────────────┘
                          │ queries DynamoDB for candidate trips,
                          │ sends compact trip list + user prompt to Gemini,
                          ▼ returns ranked/suggested trip IDs
                       Browser renders suggested trip cards
```

### External integrations (no SDK lock-in)
- **Google My Maps** — embedded read-only via `<iframe>` in the detail popup. No API.
- **Google Maps deep link** — "Open in Google Maps" button; a maps URL that opens the native app on mobile when installed, else the web.
- **Google Gemini** — called server-side from a Lambda (never the browser, to protect the API key). Takes the user's search/prompt plus a candidate set of trips and returns suggested/ranked trips.

---

## 3. Data model (DynamoDB, via Amplify Data schema)

Stored as JSON documents. Two models.

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

### Authorization rules
- **Trip**: public read (guest access via Cognito identity pool); create/update/delete restricted to `authorId` owner.
- **Favorite**: read/create/delete restricted to the owning `userId`.

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

### M0 — Project setup (½–1 day)
- Use **pnpm** as the package manager (commit `pnpm-lock.yaml`); ensure Amplify Hosting build settings use pnpm.
- `pnpm create amplify@latest` scaffold; Next.js App Router.
- Git repo + Amplify Hosting connected; staging + prod branches.
- Per-developer cloud sandbox for fast iteration (`pnpm ampx sandbox`).

### M1 — Auth (1–2 days)
- Cognito user pool with Google as social provider.
- Set up Google OAuth client in Google Cloud Console (consent screen, redirect URIs).
- Sign-in / sign-out flow; guest (unauthenticated) access for public browsing.

### M2 — Data + storage (1–2 days)
- Define Trip and Favorite models in `amplify/data/resource.ts` with auth rules.
- S3 storage resource for thumbnails; upload + signed-URL retrieval.

### M3 — Core trip CRUD (2–3 days)
- Create/edit trip form, including thumbnail upload, structured location fields (city/province/country), trip type + vehicle pickers, and My Maps URL validation.
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
- Lambda (`suggestTrips`) that takes the user's prompt + a candidate trip set, calls the Gemini API server-side, and returns ranked/suggested trip IDs (with optional "why it fits" notes).
- Gemini API key stored as a secret (Amplify secret / SSM), never exposed to the browser.
- Prompt UI on Home; render suggested cards; graceful fallback to plain search if the AI call fails.

### M7 — Maps integration (1–2 days)
- Detail popup with embedded My Maps iframe (with safe-URL guard).
- "Open in Google Maps" deep-link button; mobile handoff tested on iOS + Android.

### M8 — Polish + deploy (2–3 days)
- Responsive QA across device sizes; empty/loading/error states.
- Form validation, image size limits, basic rate sanity.
- Production deploy; smoke test the full flow.

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
| Cognito + Next.js SSR session handling | Use the official `@aws-amplify/adapter-nextjs` patterns for server-side auth |
| Gemini API key leakage | Call Gemini only from Lambda/server; store key as a secret; never ship it to the browser |
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
