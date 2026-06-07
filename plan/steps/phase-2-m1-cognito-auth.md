# Phase 2 — M1: Cognito (Google OAuth) + SSR sessions + route guards

**Goal (GOAL-002):** Provision Cognito (User Pool + Identity Pool + Google) via
Terraform; wire client auth + SSR sessions.

**Source tasks:** TASK-008 … TASK-014
**Depends on:** Phase 1 (Terraform backend, modules, Amplify env-var plumbing).
**Unlocks:** every authenticated route and the `sub`-based ownership checks used
by Lambdas in M3+.

---

## Prerequisites

- Phase 1 complete; `infra/modules/cognito` stub exists.
- Access to Google Cloud Console to create an OAuth client.
- `aws-amplify` and `@aws-amplify/adapter-nextjs` added to the app:
  `pnpm add aws-amplify @aws-amplify/adapter-nextjs` (DEP-003).

---

## TASK-008 — Create the Google OAuth 2.0 client

**Do:**
1. In Google Cloud Console → APIs & Services → OAuth consent screen: configure
   (external), add scopes `openid email profile`, add test users if needed.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Authorized redirect URIs: the Cognito Hosted UI callback for **each** env, i.e.
   `https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`.
   *(You may need to apply TASK-010 once to learn the domain, then come back and
   fill these in — note that ordering.)*
4. Record the **client ID** and **client secret**.

**Done check:** an OAuth client exists with consent screen configured and redirect
URIs pointing at each Cognito Hosted UI domain.

---

## TASK-009 — Store Google secrets in SSM

**Do:**
1. Add `aws_ssm_parameter` (type `SecureString`) per env:
   - `/<env>/road-rash/google_oauth_client_id`
   - `/<env>/road-rash/google_oauth_client_secret`
2. Keep values **out of version control** — pass via `-var`, `TF_VAR_*`, or a
   git-ignored tfvars; reference them in the cognito module (SEC-001, PAT-003).

**Files:** `infra/modules/cognito/` (or a small `ssm` block), `infra/envs/*/`.

**Done check:** parameters exist as SecureString; no secret value appears in git
or in plan output committed anywhere.

---

## TASK-010 — `cognito` module

**Do:** in `infra/modules/cognito`, define:
1. `aws_cognito_user_pool` (email as username/attr; MFA optional for MVP).
2. `aws_cognito_user_pool_client` — OAuth flows = authorization code, scopes
   `openid email profile`, callback/logout URLs for each env's app domain, no
   client secret on the public SPA client (or a confidential client per design).
3. `aws_cognito_user_pool_domain` — Hosted UI domain (feeds TASK-008 redirect URIs).
4. `aws_cognito_identity_provider` — Google: `client_id`/`client_secret` from the
   SSM params (TASK-009), attribute mapping (email, name), scopes `email profile openid`.
5. `aws_cognito_identity_pool` + authenticated/unauthenticated `aws_iam_role` +
   `aws_cognito_identity_pool_roles_attachment`.
6. Outputs: user pool ID, client ID, identity pool ID, domain, issuer URL,
   audience — wired into Amplify env vars (TASK-006).

**Files:** `infra/modules/cognito/{main,variables,outputs}.tf`, env wiring.

**Done check:** `terraform apply` creates the pool/client/domain/IdP/identity pool;
Google appears as a federated IdP; outputs flow to Amplify `NEXT_PUBLIC_*` env vars.

---

## TASK-011 — Client-side Amplify configuration

**Do:**
1. `lib/amplify-config.ts` — call `Amplify.configure({...}, { ssr: true })` using
   `NEXT_PUBLIC_*` Cognito values (no `amplify_outputs.json`; manual config per
   GUD-001/CON-004). Configure Auth with the Cognito user/identity pool + OAuth
   (domain, scopes, redirect sign-in/out, response type `code`).
2. `components/ConfigureAmplifyClientSide.tsx` — `'use client'`, imports the config
   for its side effect, renders `null`.
3. Mount `<ConfigureAmplifyClientSide />` in `app/layout.tsx`.

**Files:** `lib/amplify-config.ts`, `components/ConfigureAmplifyClientSide.tsx`,
`app/layout.tsx`.

**Done check:** the app loads with Amplify configured client-side and no console
errors about missing Auth config.

---

## TASK-012 — SSR server context

**Do:**
1. `lib/amplify-server-utils.ts` — export `runWithAmplifyServerContext` created via
   `createServerRunner` from `@aws-amplify/adapter-nextjs`, using the same config.

**Files:** `lib/amplify-server-utils.ts`.

**Done check:** server components/route handlers can run
`runWithAmplifyServerContext({ nextServerContext, operation })` without error.

---

## TASK-013 — Login page

**Do:**
1. `app/login/page.tsx` (`'use client'`):
   - "Continue with Google" → `signInWithRedirect({ provider: 'Google' })`.
   - `signOut()` action for testing.
   - Show current user via `getCurrentUser()`/`fetchAuthSession()`.

**Files:** `app/login/page.tsx`.

**Done check:** clicking "Continue with Google" goes through Cognito Hosted UI →
Google → back to the app authenticated; `signOut()` clears the session.

---

## TASK-014 — Route guards (middleware + server)

**Do:**
1. `middleware.ts` — use `fetchAuthSession` within `runWithAmplifyServerContext`
   to check auth on protected paths and redirect to `/login` when unauthenticated.
2. Protect: `/trips/new`, `/trips/[id]/edit`, `/my-trips`, `/saved`.
   *(Public browsing stays open — REQ-002.)*
3. Configure the `matcher` so public routes (`/`, `/trip/[id]`, static assets)
   bypass the guard.

**Files:** `middleware.ts`.

**Done check:** visiting a protected route while signed out redirects to `/login`;
after sign-in it renders; public routes never redirect (RISK-009 — uses official
adapter patterns).

---

## Phase verification (M1 exit)

- [ ] Google → Cognito federated sign-in works end-to-end (redirect flow).
- [ ] Session is readable in both client and SSR/server contexts.
- [ ] Protected routes redirect when signed out; public routes stay open.
- [ ] No secrets in the browser bundle; secrets only in SSM.

## Task checklist

- [ ] TASK-008 — Google OAuth client + consent screen
- [ ] TASK-009 — Google secrets in SSM (SecureString)
- [ ] TASK-010 — `cognito` module (pool/client/domain/IdP/identity pool)
- [ ] TASK-011 — Client Amplify config + layout mount
- [ ] TASK-012 — SSR `createServerRunner` util
- [ ] TASK-013 — `/login` page
- [ ] TASK-014 — Middleware/server route guards
