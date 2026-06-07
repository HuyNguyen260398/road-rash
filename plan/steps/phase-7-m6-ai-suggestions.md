# Phase 7 — M6: Gemini `suggestTrips` + AI prompt UI + safe fallback

**Goal (GOAL-007):** Gemini-backed `suggestTrips` Lambda behind `POST /suggest`;
AI prompt UI with safe fallback.

**Source tasks:** TASK-038 … TASK-042
**Depends on:** Phase 6 (search produces the candidate set), Phase 3 (API + IAM).
**Unlocks:** AI discovery; plain search remains the always-on fallback.

> **Guardrails:** Gemini is **server-side only** (SEC-001/ALT-007). It ranks
> **only** IDs from the candidate set passed in, and returned IDs are **validated
> against DynamoDB** before render (REQ-007, RISK-007). Triggers on **explicit
> submit only** (CON-003).

---

## TASK-038 — Store the Gemini key in SSM

**Do:**
1. `aws_ssm_parameter` (SecureString) `/<env>/road-rash/gemini_api_key` per env.
   Value passed via `TF_VAR_*`/git-ignored tfvars — never committed (SEC-001).

**Files:** `infra/modules/.../ssm`, `infra/envs/*/`.

**Done check:** parameter exists as SecureString; value absent from git.

---

## TASK-039 — `services/suggest-trips/handler.ts` + `POST /suggest`

**Do:**
1. Public route (throttled hard at the API Gateway stage — RISK-006).
2. Handler:
   - Read the candidate trips (from the request and/or by querying `Trip`).
   - Build a **compact** prompt (don't dump full records — IDs + key fields).
   - Read the Gemini key from SSM at runtime (`@aws-sdk/client-ssm`).
   - Call the Gemini REST API with a **bounded timeout (~30s)**.
   - Parse **strict JSON** `[{ id, reason }]`.
   - **Filter to IDs present in the candidate set**, then re-validate those IDs
     against DynamoDB before returning (REQ-007).
3. Add the route in the `apigateway` module.

**Files:** `services/suggest-trips/handler.ts`, `infra/modules/apigateway/`.

**Done check (TEST-004):** any Gemini-returned ID **not** in the candidate set is
dropped; only validated IDs are returned.

---

## TASK-040 — IAM for the suggest Lambda

**Do:**
1. Grant read on the `Trip` table (`Query`/`GetItem`) and `ssm:GetParameter` on
   the `gemini_api_key` name **only** (SEC-005).

**Files:** `infra/modules/iam/`.

**Done check:** policy ARNs are scoped to `Trip` + the one parameter; no wildcards.

---

## TASK-041 — `components/AiSuggestBox.tsx`

**Do:**
1. Prompt UI ("Where do you want to ride?") that submits on **explicit click**
   (never per-keystroke — CON-003) to `POST /suggest`.
2. Render suggested cards with optional "why it fits" (the `reason`).

**Files:** `components/AiSuggestBox.tsx`.

**Done check:** submitting a prompt returns ranked cards; nothing fires while typing.

---

## TASK-042 — Graceful fallback

**Do:**
1. On Gemini error/timeout: show a non-blocking message and **fall back to plain
   search** (M5) so the user still gets results (RISK-006).

**Files:** `components/AiSuggestBox.tsx` (+ shared search hook).

**Done check:** simulate a Gemini failure → the UI degrades to plain search results
with a clear message; no crash, no spinner hang.

---

## Phase verification (M6 exit)

- [ ] `POST /suggest` returns only validated, candidate-set IDs.
- [ ] Key stays server-side (never in the browser bundle/network from client).
- [ ] AI fires on submit only; plain search is the fallback on failure/timeout.
- [ ] `pnpm test` green (incl. TEST-004).

## Task checklist

- [ ] TASK-038 — `gemini_api_key` in SSM
- [ ] TASK-039 — suggest Lambda + `POST /suggest` (TEST-004)
- [ ] TASK-040 — suggest Lambda IAM (Trip read + GetParameter)
- [ ] TASK-041 — `AiSuggestBox`
- [ ] TASK-042 — graceful fallback to plain search
