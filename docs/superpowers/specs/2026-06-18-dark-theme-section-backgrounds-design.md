# Dark-theme background images for the hero and CTA sections

**Date:** 2026-06-18
**Status:** Approved

## Problem

The landing page has two full-bleed sections with photographic backgrounds:

- **Hero** (`components/LandingHero.tsx`) — currently `/hero-road.jpg` (a daytime open road).
- **Closing CTA** "Your next route is waiting" (`components/LandingCta.tsx`) — currently `/cta-sunset-road.jpg` (a sunset road).

Both images are light/daytime. The app supports a light/dark theme toggle (`components/theme-provider.tsx`, surfaced via `components/ModeToggle.tsx`), which applies a `.dark` class to `<html>`. When the user switches to dark mode, the section backgrounds stay light, which clashes with the rest of the dark UI.

**Goal:** when the theme switches, these two section backgrounds switch to night-time variants too.

## Selected images

Both chosen from Unsplash (free for commercial use, no attribution required) during a visual brainstorming session.

| Section | Light (existing, unchanged) | Dark (new) | Source |
|---|---|---|---|
| Hero | `/hero-road.jpg` | `/hero-night.jpg` — a winding road curving into the Milky Way (Joshua Tree) | https://unsplash.com/photos/road-under-milky-way-galaxy-lVdYJFm3QaM (image: `https://images.unsplash.com/photo-1511424011930-878efa4d6ed2`) |
| CTA | `/cta-sunset-road.jpg` | `/cta-night.jpg` — a lit tent glowing under the Milky Way in the desert, by Wolfgang Hasselmann | https://unsplash.com/photos/tent-under-starry-night-sky-with-milky-way-R4NEEsb_Xh0 (image: `https://images.unsplash.com/photo-1758705023495-b64dfe01f970`) |

The existing light images are kept as-is; we only add the two dark ones.

## Approach

**CSS class swap, keyed off the existing `.dark` selector.** Move the `background-image` out of the inline `style={...}` in each component and into CSS rules in `app/globals.css`:

```css
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

The theme provider applies `.dark` to `<html>` before first paint, so the correct image is chosen by CSS with **no hydration flash and no JavaScript**. This matches how every other dark-mode style in the app already works.

### Alternatives considered

- **JS via `useTheme()` `resolvedTheme`** — read the resolved theme in the component and pick the URL. Rejected: on SSR / first paint `resolvedTheme` resolves to `"light"`, so a dark-mode user would briefly see the light image before it swaps — a visible flicker.
- **`<picture>` + `prefers-color-scheme`** — Rejected: that follows only the OS color scheme, not the app's manual light/dark toggle, so it would ignore the user's explicit choice.

## Changes

1. **`public/hero-night.jpg`, `public/cta-night.jpg`** — download the two Unsplash photos at ~2400px wide, JPG, compressed to roughly match the existing files (existing are ~280–290 KB; target a similar range).
2. **`app/globals.css`** — add the four background-image rules above, near the existing `.dark` and `.hero-kenburns` rules.
3. **`components/LandingHero.tsx`** — replace `style={{ backgroundImage: "url('/hero-road.jpg')" }}` on the `.hero-kenburns` element with `className="... hero-bg-image"`. Keep `bg-cover bg-center`, the `.hero-kenburns` zoom, and the `.hero-bg` parallax wrapper untouched.
4. **`components/LandingCta.tsx`** — same swap with the `cta-bg-image` class.

The dark gradient overlays in both sections already darken the image for white-text legibility and are unchanged; they work for the night images too.

## Out of scope

- No changes to the theme provider, toggle, or `prefers-color-scheme` handling.
- No new image-optimization pipeline (`next/image`); these are CSS backgrounds, consistent with the current implementation.
- No changes to the existing light images or any other section.

## Verification

- `pnpm build` (includes `tsc` typecheck), `pnpm lint`, `pnpm format:check` all pass.
- Manual check in `pnpm dev`: toggle light ↔ dark and confirm both the hero and CTA backgrounds swap with the theme, and that loading the page already in dark mode shows the night images with no flash of the light image.
- The existing `components/theme-provider.test.tsx` continues to pass (the toggle mechanism itself is unchanged).
