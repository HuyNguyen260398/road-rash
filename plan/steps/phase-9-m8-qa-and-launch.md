# Phase 9 — M8: Responsive QA + limits + prod apply + smoke test

**Goal (GOAL-009):** Responsive QA, limits, production `terraform apply` + deploy +
smoke test.

**Source tasks:** TASK-047 … TASK-050
**Depends on:** Phases 1–8 (the full app + infra).
**Unlocks:** production launch.

---

## TASK-047 — Responsive QA

**Do:**
1. Walk every screen (Home, My Trips, Saved, search/AI, trip detail, login,
   new/edit) on **phone / tablet / desktop** widths (REQ-001).
2. Verify **loading / empty / error** states on each.

**Done check:** no layout breakage across breakpoints; all three states present and
sane on every screen.

---

## TASK-048 — Enforce limits & validation

**Do:**
1. Confirm form validation is enforced (required fields, My Maps URL).
2. Confirm image **size/type limits** on both the client and the presign Lambda
   (SEC-004).
3. Add basic rate-sanity on create (avoid trivial spam).

**Done check (ties TEST-008):** oversized/non-image uploads are rejected client-side
and server-side; invalid forms can't submit.

---

## TASK-049 — Production provision + deploy

**Do:**
1. Configure `prod` tfvars + secrets (SSM values for Google + Gemini).
2. `terraform -chdir=infra/envs/prod plan` → review → `apply` (GUD-004; no console
   edits).
3. Deploy `main` via Amplify Hosting (pnpm build spec).

**Done check (TEST-009):** `prod` plan shows no unexpected diffs; apply succeeds;
`main` deploys and serves on the prod Amplify domain.

---

## TASK-050 — End-to-end smoke test

**Do (TEST-010):** run the full flow in prod (or a prod-like env):
1. Sign in (Google → Cognito).
2. Create a trip with a thumbnail + a valid My Maps URL.
3. It appears on Home.
4. Search/filter finds it.
5. Favorite it (count updates; appears in Saved).
6. AI suggestion returns it for a relevant prompt.
7. Detail modal embeds the map.
8. "Open in Google Maps" works on mobile.

**Done check:** every step passes end-to-end; log any defects and resolve before
declaring launch.

---

## Phase verification (M8 exit / launch)

- [ ] Responsive across phone/tablet/desktop; all states verified.
- [ ] Upload + form limits enforced client + server.
- [ ] `prod` applied cleanly via Terraform; `main` deployed via Amplify.
- [ ] Full smoke flow (TEST-010) passes.

## Post-launch — explicitly deferred (do NOT build now)

Per `docs/road-rash-plan.md` §7 and the plan's Alternatives:
- Personalization / ratings, PWA (ALT-006), OpenSearch full-text (ALT-005),
  stream-driven `favoriteCount` reconciler (RISK-005).

## Task checklist

- [ ] TASK-047 — responsive QA + states
- [ ] TASK-048 — limits & validation (client + presign)
- [ ] TASK-049 — prod tfvars/secrets + `terraform apply` + deploy
- [ ] TASK-050 — end-to-end smoke test (TEST-010)
