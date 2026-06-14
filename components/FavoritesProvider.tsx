"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Hub } from "aws-amplify/utils";
import { api } from "@/lib/api-client";

// Client-side favorites state (M4 / TASK-030). Loaded once on mount so every
// TripCard can render its own favorited/heart-count without N per-card requests.
// The heart toggle is *optimistic*: local state flips immediately, the request
// fires, and a failure reverts. Counts are tracked as a delta layered on top of
// each trip's stored favoriteCount, so a card stays correct without refetching.

type FavoritesContextValue = {
  /** Favorites have finished their initial load (signed-in users). */
  ready: boolean;
  /** Whether the current visitor is signed in (drives the login redirect). */
  signedIn: boolean;
  isFavorited: (tripId: string) => boolean;
  /** Optimistic +/-1 to add to a trip's stored favoriteCount for display. */
  countDelta: (tripId: string) => number;
  /** Optimistically toggle; reverts on error. No-op if signed out. */
  toggle: (tripId: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return ctx;
}

export default function FavoritesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [favorited, setFavorited] = useState<Set<string>>(new Set());
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  // Guards against overlapping toggles on the same trip (double-tap).
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    function load() {
      api
        .getFavorites()
        .then(({ favorites }) => {
          if (!active) return;
          setFavorited(new Set(favorites.map((f) => f.tripId)));
          setSignedIn(true);
        })
        .catch(() => {
          // 401 (signed out) or API not reachable yet — render hearts as empty.
        })
        .finally(() => {
          if (active) setReady(true);
        });
    }

    // Initial load on mount.
    load();

    // The Google OAuth redirect lands on "/" while Amplify is still completing
    // the token exchange, so this first load can 401. Re-run once sign-in
    // completes (and reset on sign-out) so the header's auth controls flip
    // without a manual reload — same pattern as UserMenu / the login page.
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signInWithRedirect":
          load();
          break;
        case "signedOut":
          if (!active) return;
          setFavorited(new Set());
          setDeltas({});
          setSignedIn(false);
          break;
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const isFavorited = useCallback(
    (tripId: string) => favorited.has(tripId),
    [favorited],
  );

  const countDelta = useCallback(
    (tripId: string) => deltas[tripId] ?? 0,
    [deltas],
  );

  const toggle = useCallback(
    async (tripId: string) => {
      if (!signedIn) return;
      if (inFlight.current.has(tripId)) return;
      inFlight.current.add(tripId);

      const wasFavorited = favorited.has(tripId);
      const step = wasFavorited ? -1 : 1;

      // Optimistic local update.
      setFavorited((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.delete(tripId);
        else next.add(tripId);
        return next;
      });
      setDeltas((prev) => ({ ...prev, [tripId]: (prev[tripId] ?? 0) + step }));

      try {
        if (wasFavorited) await api.removeFavorite(tripId);
        else await api.addFavorite(tripId);
      } catch {
        // Revert both the membership and the count delta on failure.
        setFavorited((prev) => {
          const next = new Set(prev);
          if (wasFavorited) next.add(tripId);
          else next.delete(tripId);
          return next;
        });
        setDeltas((prev) => ({
          ...prev,
          [tripId]: (prev[tripId] ?? 0) - step,
        }));
      } finally {
        inFlight.current.delete(tripId);
      }
    },
    [signedIn, favorited],
  );

  return (
    <FavoritesContext.Provider
      value={{ ready, signedIn, isFavorited, countDelta, toggle }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}
