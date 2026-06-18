# Dark-theme Section Backgrounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the landing hero and closing CTA background images swap to night-time variants when the user switches to dark mode.

**Architecture:** Move each section's `background-image` out of an inline React `style` and into a CSS class in `app/globals.css`. Define a light default and a `.dark`-scoped override per section. Because the theme provider applies `.dark` to `<html>` before first paint, CSS selects the correct image with no JavaScript and no hydration flash.

**Tech Stack:** Next.js (App Router), Tailwind v4 + `app/globals.css`, custom `ThemeProvider` (`.dark` class on `<html>`). Image download via `curl`; this is a macOS (darwin) environment.

---

### Task 1: Add the two dark-theme images to `public/`

**Files:**
- Create: `public/hero-night.jpg`
- Create: `public/cta-night.jpg`

Both images are from Unsplash (free for commercial use, no attribution required). Source pages, for the record:
- Hero — winding road under the Milky Way (Joshua Tree): https://unsplash.com/photos/road-under-milky-way-galaxy-lVdYJFm3QaM
- CTA — tent glowing under the Milky Way (Wolfgang Hasselmann): https://unsplash.com/photos/tent-under-starry-night-sky-with-milky-way-R4NEEsb_Xh0

- [ ] **Step 1: Download both images at ~2400px wide as JPG**

Run from the repo root:

```bash
curl -L -o public/hero-night.jpg \
  "https://images.unsplash.com/photo-1511424011930-878efa4d6ed2?fm=jpg&q=80&w=2400&fit=crop"
curl -L -o public/cta-night.jpg \
  "https://images.unsplash.com/photo-1758705023495-b64dfe01f970?fm=jpg&q=80&w=2400&fit=crop"
```

- [ ] **Step 2: Verify the files are real JPEGs of a reasonable size**

Run:

```bash
file public/hero-night.jpg public/cta-night.jpg
ls -lh public/hero-night.jpg public/cta-night.jpg public/hero-road.jpg public/cta-sunset-road.jpg
```

Expected: both new files report `JPEG image data`. The existing light images are ~280–290 KB; the new ones should be in a comparable range (roughly 200 KB–1 MB). If either is dramatically larger (> ~1.2 MB), re-download it at lower quality by lowering `q=80` to `q=70` in the URL from Step 1.

- [ ] **Step 3: Commit**

```bash
git add public/hero-night.jpg public/cta-night.jpg
git commit -m "feat(theme): add dark-mode hero and CTA background images"
```

---

### Task 2: Add the theme-aware background CSS

**Files:**
- Modify: `app/globals.css` (insert after the `.hero-kenburns` reduced-motion block, currently ending at line 195)

- [ ] **Step 1: Add the background-image rules**

In `app/globals.css`, immediately after the existing block:

```css
@media (prefers-reduced-motion: reduce) {
  .hero-kenburns {
    animation: none;
  }
}
```

insert this new block:

```css
/* Section background images swap with the light/dark theme. The .dark class is
   applied to <html> before first paint by ThemeProvider, so CSS picks the right
   image with no JS and no hydration flash. */
.hero-bg-image {
  background-image: url("/hero-road.jpg");
}
.dark .hero-bg-image {
  background-image: url("/hero-night.jpg");
}

.cta-bg-image {
  background-image: url("/cta-sunset-road.jpg");
}
.dark .cta-bg-image {
  background-image: url("/cta-night.jpg");
}
```

- [ ] **Step 2: Verify formatting passes**

Run: `pnpm format:check`
Expected: PASS (no formatting changes needed for `app/globals.css`). If it fails, run `pnpm format` and re-check.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(theme): add theme-aware section background CSS classes"
```

---

### Task 3: Use the hero background class instead of an inline style

**Files:**
- Modify: `components/LandingHero.tsx:65-68`

- [ ] **Step 1: Replace the inline background style with the CSS class**

Find this element (inside the `.hero-bg` parallax wrapper):

```tsx
        <div
          className="hero-kenburns absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-road.jpg')" }}
        />
```

Replace it with:

```tsx
        <div className="hero-kenburns hero-bg-image absolute inset-0 bg-cover bg-center" />
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm lint`
Expected: PASS, no errors in `components/LandingHero.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/LandingHero.tsx
git commit -m "feat(theme): swap hero background by theme via CSS class"
```

---

### Task 4: Use the CTA background class instead of an inline style

**Files:**
- Modify: `components/LandingCta.tsx:20-23`

- [ ] **Step 1: Replace the inline background style with the CSS class**

Find this element (inside the CTA's `aria-hidden` background wrapper):

```tsx
        <div
          className="hero-kenburns absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/cta-sunset-road.jpg')" }}
        />
```

Replace it with:

```tsx
        <div className="hero-kenburns cta-bg-image absolute inset-0 bg-cover bg-center" />
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm lint`
Expected: PASS, no errors in `components/LandingCta.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/LandingCta.tsx
git commit -m "feat(theme): swap CTA background by theme via CSS class"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the build, lint, format, and tests**

Run:

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm test
```

Expected: all pass. `pnpm build` runs the `tsc` typecheck; `pnpm test` (Vitest) includes the unchanged `components/theme-provider.test.tsx`.

- [ ] **Step 2: Manual theme-toggle check**

Run `pnpm dev`, open the landing page, and use the theme toggle (ModeToggle in the header):

- Light mode: hero shows `hero-road.jpg`, CTA shows `cta-sunset-road.jpg`.
- Dark mode: hero shows the winding-road Milky Way image, CTA shows the tent-under-the-stars image.
- Toggling light ↔ dark swaps both section backgrounds.
- Reload the page while in dark mode: the night images appear immediately, with no flash of the light image.
- Confirm the white headline and buttons remain legible over both night images (the existing dark gradient overlays are unchanged).

- [ ] **Step 3: No commit needed**

This task only verifies; no code changes.

---

## Notes for the executor

- Do **not** modify the existing light images, the theme provider, `ModeToggle`, the `.hero-kenburns` animation, the `.hero-bg` parallax wrapper, or the gradient overlays — only the four points listed above.
- Keep `bg-cover bg-center` on both elements; only the `background-image` source moves to CSS.
- The work is on branch `feature/dark-theme-section-backgrounds`, which already contains the design spec commit.
