import type { Trip } from "./types";

// Pick the "trending" trips for the landing-page strip: most-favorited first,
// ties broken by most-recently created. Pure and side-effect-free (no gsap / no
// DOM) so it unit-tests in the node Vitest env. Copies the input before sorting
// so callers' arrays are never mutated.
export function selectTrending(trips: Trip[], n: number): Trip[] {
  return [...trips]
    .sort((a, b) => {
      if (b.favoriteCount !== a.favoriteCount) {
        return b.favoriteCount - a.favoriteCount;
      }
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, Math.max(0, n));
}
