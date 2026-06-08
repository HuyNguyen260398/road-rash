# Phase 8 — M7: Trip detail modal + safe My Maps iframe + deep link

**Goal (GOAL-008):** Trip detail modal with safe My Maps iframe and "Open in Google
Maps" deep link.

**Source tasks:** TASK-043 … TASK-046
**Depends on:** Phase 4 (`TripCard`/`TripGrid`), Phase 5 (`/trip/[id]`), Phase 4
(`toMyMapsEmbedUrl`).
**Unlocks:** the full trip-viewing experience; final UX before launch QA.

> **Constraint:** the map is a user-supplied URL rendered read-only; "Open in
> Google Maps" is a **best-effort** mobile deep link, not a guaranteed native
> handoff (CON-001).

---

## TASK-043 — `components/TripDetailModal.tsx`

**Do:**
1. Show full trip info + favorite heart (reuse the M4 toggle).
2. Embed the My Maps map as a read-only `<iframe>` built via `toMyMapsEmbedUrl`,
   guarded by the **host allow-list** (`validateMyMapsUrl`) before rendering
   (SEC-003 — never embed an unvalidated URL).

**Files:** `components/TripDetailModal.tsx`.

**Done check:** valid My Maps URLs embed; a non–My Maps URL is never injected into
the iframe `src`.

**Commit:** `feat(m7): TripDetailModal + safe iframe (TASK-043)` — one task, one
commit, before TASK-044.

---

## TASK-044 — Iframe load-failure fallback

**Do:**
1. Detect load failure (onError + a timeout) for private/blocked maps and fall back
   to a plain "Open map" link (RISK-004).

**Files:** `components/TripDetailModal.tsx`.

**Done check:** a private/blocked map shows the fallback link instead of a broken
embed.

**Commit:** `feat(m7): iframe load-failure fallback (TASK-044)` — one task, one commit,
before TASK-045.

---

## TASK-045 — "Open in Google Maps" deep link

**Do:**
1. Button using `googleMapsUrl` (or a maps query URL) that deep-links to the native
   app on mobile; falls back to web on desktop.
2. Test on **iOS and Android** (best-effort handoff — CON-001).

**Files:** `components/TripDetailModal.tsx`.

**Done check:** on mobile the button attempts the native app; on desktop it opens
maps in the browser.

**Commit:** `feat(m7): Open in Google Maps deep link (TASK-045)` — one task, one
commit, before TASK-046.

---

## TASK-046 — Wire modal into grid + deep links

**Do:**
1. `TripCard`/`TripGrid` open `TripDetailModal` on tap/click.
2. Ensure `/trip/[id]` (the public share route) renders the same detail content for
   deep links / shared URLs.

**Files:** `components/TripCard.tsx`, `components/TripGrid.tsx`,
`app/trip/[id]/page.tsx`.

**Done check:** clicking a card opens the modal; visiting `/trip/[id]` directly
renders the detail content.

**Commit:** `feat(m7): wire modal + /trip/[id] deep links (TASK-046)` — final task of
the phase; one commit.

---

## Phase verification (M7 exit)

- [ ] Detail modal embeds validated My Maps URLs only; fallback link works.
- [ ] "Open in Google Maps" deep-links on iOS + Android, web on desktop.
- [ ] Cards open the modal; `/trip/[id]` renders detail for deep links.

## Task checklist

- [ ] TASK-043 — `TripDetailModal` + safe iframe
- [ ] TASK-044 — iframe load-failure fallback
- [ ] TASK-045 — "Open in Google Maps" deep link (iOS/Android)
- [ ] TASK-046 — wire modal + `/trip/[id]` deep links
