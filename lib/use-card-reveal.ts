"use client";

import { useEffect, useRef, useState } from "react";

// Drives the AWS-style "loading → reveal" phase for a card grid. While `phase`
// is "loading" the caller shows skeleton placeholders; after a short debounced
// delay it flips to "ready" and the real cards float in.
//
// `key` identifies the current result set (e.g. the filtered trips array). Each
// time it changes the phase resets to "loading" and the timer restarts, so rapid
// changes (typing in the search box) keep the skeletons up and let the results
// "pop in" once things settle — rather than strobing on every keystroke.
//
// Users who prefer reduced motion skip the delay entirely (cards appear at once).
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useCardReveal(key: unknown, delayMs = 320) {
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [prevKey, setPrevKey] = useState(key);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New result set → back to the loading phase. Adjusting state during render
  // (per React's "you might not need an effect" guidance) re-renders immediately.
  if (key !== prevKey) {
    setPrevKey(key);
    setPhase("loading");
  }

  // Restarts whenever the key changes (prevKey is the dependency), giving the
  // debounce: each change clears the pending timer and starts a fresh one.
  // Reduced-motion users get a zero delay so the cards appear at once.
  useEffect(() => {
    const delay = prefersReducedMotion() ? 0 : delayMs;
    timeoutRef.current = setTimeout(() => setPhase("ready"), delay);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [prevKey, delayMs]);

  return phase;
}
