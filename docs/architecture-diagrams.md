# road-rash — Architecture Diagrams

Mermaid diagrams generated from the code and Terraform on disk (2026-06-15). GitHub renders Mermaid natively; for local preview use the [Mermaid Live Editor](https://mermaid.live) or a Markdown extension.

Contents:
1. [AWS resources](#1-aws-resources-must-have) — every AWS service this project provisions
2. [Request & authorization flow](#2-request--authorization-flow)
3. [AI suggestion flow](#3-ai-suggestion-flow)
4. [Data model (DynamoDB)](#4-data-model-dynamodb)
5. [CI/CD & Terraform](#5-cicd--terraform)

---

## 1. AWS resources (must-have)

Every AWS service used, the four Lambdas, and the external Google dependencies. Mirrors `infra/modules/*` (cognito, apigateway, lambda, dynamodb, s3, ssm, hosting, iam) and the route map in `infra/envs/staging/main.tf`.

```mermaid
flowchart TB
    subgraph users[Users]
        guest([Guest / visitor])
        author([Authenticated author])
    end

    subgraph google[Google Cloud - external]
        goauth[Google OAuth 2.0]
        gmaps[Google My Maps - embed iframe]
        gemini[Google Gemini API]
    end

    subgraph aws[AWS account]
        direction TB

        amplify[AWS Amplify Hosting<br/>Next.js SSR app]

        subgraph identity[Amazon Cognito]
            cogdomain[Hosted UI Domain]
            userpool[User Pool]
            appclient[User Pool Client]
            idpool[Identity Pool]
        end

        subgraph edge[Amazon API Gateway - HTTP API v2]
            api[HTTP API<br/>default stage + CORS + throttling]
            authz[JWT Authorizer]
        end

        subgraph compute[AWS Lambda]
            l_trips[trips]
            l_fav[favorites]
            l_presign[presign]
            l_suggest[suggest-trips]
        end

        subgraph data[Data and media]
            t_trip[(DynamoDB Trip<br/>5 filter/group GSIs)]
            t_fav[(DynamoDB Favorite<br/>userId GSI)]
            s3thumb[S3 thumbnails bucket]
        end

        ssm[SSM Parameter Store<br/>Gemini key - SecureString]
        logs[CloudWatch Logs]
        iam[IAM roles<br/>least-privilege per Lambda]
    end

    guest -->|browse / search| amplify
    author -->|create / favorite| amplify
    author -->|sign in| cogdomain
    cogdomain --> userpool
    appclient --> userpool
    userpool -. federates .-> goauth
    idpool -. trusts .-> userpool

    amplify -->|REST + Cognito JWT| api
    amplify -->|presigned PUT upload| s3thumb
    amplify -->|render map| gmaps

    api --> authz
    authz -. validates token .-> userpool
    api -->|AWS_PROXY| l_trips
    api -->|AWS_PROXY| l_fav
    api -->|AWS_PROXY| l_presign
    api -->|AWS_PROXY| l_suggest

    l_trips -->|CRUD + Query/Scan| t_trip
    l_fav -->|favorite CRUD| t_fav
    l_fav -->|UpdateItem favoriteCount| t_trip
    l_presign -->|sign PUT/GET URLs| s3thumb
    l_suggest -->|GetItem revalidate ids| t_trip
    l_suggest -->|GetParameter| ssm
    l_suggest -->|rank candidates| gemini

    l_trips -. logs .-> logs
    l_fav -. logs .-> logs
    l_presign -. logs .-> logs
    l_suggest -. logs .-> logs
    iam -. assumed by .-> compute
```

**Notes**
- **Public vs. authenticated:** `GET /trips`, `GET /trips/{id}`, `GET /uploads/thumbnail`, and `POST /suggest` carry no authorizer; all other routes sit behind the Cognito JWT authorizer.
- **Throttling:** `POST /suggest` is hard-capped (5 burst / 2 rps) to bound Gemini spend; `POST /trips` is capped (10 / 5).
- **Least privilege:** the favorites role gets Favorite CRUD + `UpdateItem`-only on Trip; the suggest role is read-only on Trip + `GetParameter` on exactly one SSM key.

---

## 2. Request & authorization flow

The two-layer authorization model (edge JWT authorizer + in-handler ownership check) for a trip edit, plus a public read.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (lib/api-client)
    participant API as API Gateway
    participant AZ as JWT Authorizer (Cognito)
    participant L as trips Lambda
    participant D as DynamoDB Trip

    Note over B,D: Public read (no token)
    B->>API: GET /trips
    API->>L: AWS_PROXY (authorizer = NONE)
    L->>D: Scan / GSI Query (filters)
    D-->>L: items
    L-->>B: 200 { trips }

    Note over B,D: Authenticated write (layer 1 + layer 2)
    B->>API: PUT /trips/{id} + Bearer ID token
    API->>AZ: validate token (issuer + audience)
    AZ-->>API: claims { sub, name, email }
    API->>L: AWS_PROXY with verified claims
    L->>D: GetItem(id)
    D-->>L: existing trip
    L->>L: ownership check — claims.sub == trip.authorId?
    alt not owner
        L-->>B: 403 Not the trip owner
    else owner
        L->>D: PutItem (server-owned fields preserved)
        L-->>B: 200 updated trip
    end
```

---

## 3. AI suggestion flow

`POST /suggest` — server-side Gemini, candidate-bounded, re-validated, with a plain-search fallback on the client.

```mermaid
sequenceDiagram
    autonumber
    participant U as TripBrowser (client)
    participant API as API Gateway (throttled)
    participant L as suggest-trips Lambda
    participant S as SSM Parameter Store
    participant G as Google Gemini
    participant D as DynamoDB Trip

    U->>API: POST /suggest { prompt, candidates[] }
    API->>L: AWS_PROXY (public)
    L->>S: GetParameter (Gemini key, cached per cold start)
    L->>G: rank candidate ids (AbortController timeout)
    alt Gemini ok
        G-->>L: [{ id, reason }]
        L->>L: keep only candidate-set ids + cap to 12
        L->>D: GetItem per id (confirm still exists)
        D-->>L: surviving ids
        L-->>U: 200 { suggestions }
        U->>U: render ranked grid with reasons
    else Gemini error / timeout
        L-->>U: 502
        U->>U: fall back to plain client-side search
    end
```

---

## 4. Data model (DynamoDB)

DynamoDB is schemaless for non-key attributes; this ER view shows the keys/GSIs and the denormalized counter. The relationship is logical (no enforced FK) — `Favorite.tripId` references `Trip.id`.

```mermaid
erDiagram
    TRIP ||--o{ FAVORITE : "favorited via tripId"

    TRIP {
        string id PK
        string country "GSI country-index"
        string province "GSI province-index"
        string city "GSI city-index"
        string tripType "GSI tripType-index"
        string vehicle "GSI vehicle-index"
        string name
        string location
        number durationDays
        string myMapsUrl
        string thumbnailKey
        string authorId
        string authorName
        number favoriteCount "denormalized counter"
        string createdAt
        string updatedAt
    }

    FAVORITE {
        string tripId PK "partition key, references Trip.id"
        string userId PK "sort key, userId-index GSI hash"
        string createdAt
    }
```

**Notes**
- `Trip.favoriteCount` is maintained by the favorites Lambda with an atomic guarded `UpdateItem` — never recomputed by scanning `Favorite`.
- `Favorite`'s composite key `(tripId, userId)` enforces one favorite per user per trip (conditional `PutItem`); the `userId-index` GSI (`KEYS_ONLY`) backs the saved-trips view.

---

## 5. CI/CD & Terraform

PR gates, the OIDC-based deploy to staging, and Terraform remote state.

```mermaid
flowchart LR
    dev([Developer]) -->|open PR| gh[GitHub repo]

    subgraph gates[PR gates - GitHub Actions]
        ci1[nextjs-ci<br/>lint · format · build · test]
        ci2[tf-ci<br/>fmt · validate · tflint]
    end
    gh --> ci1
    gh --> ci2

    gh -->|merge to main| dep[deploy.yaml]
    dep -->|OIDC AssumeRole - no static keys| oidc[IAM OIDC provider<br/>+ deploy/terraform roles]
    dep -->|pnpm build:lambdas| zips[Lambda dist bundles]
    dep -->|terraform apply staging| tf[Terraform]
    tf --> res[AWS staging resources]
    tf -. remote state + lock .-> state[(S3 state bucket<br/>infra/bootstrap)]
    dep -->|StartJob RELEASE| amp[Amplify staging app]

    prodnote[prod root exists but is not deployed yet] -.-> res
```

---

_Regenerate these when the route map, IAM roles, data model, or deploy pipeline change. Source of truth: `infra/`, `services/`, `lib/types.ts`._
