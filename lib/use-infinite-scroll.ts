"use client";

import { useEffect, useRef, useState } from "react";

// Client-side pagination for an already-loaded list. Renders the first `pageSize`
// items and grows the visible window by `pageSize` as the user scrolls toward the
// returned `sentinelRef` element — an auto "load more" with no button. The full
// dataset is already in memory (no API calls), so this is purely a render-window
// concern.
//
// Loading only ever happens in response to a user scroll. An IntersectionObserver
// fires once on observe with the sentinel's current state, so honoring it
// unconditionally would auto-load (and cascade through every page) whenever the
// first page doesn't fill the viewport — e.g. 12 cards = 3 rows on a wide desktop.
// We therefore don't arm the observer until the user has scrolled at least once.
// The one exception is a page too short to scroll at all, where the rest would be
// unreachable: there we fill the viewport.
//
// The window resets to `pageSize` whenever `items` changes identity (a new
// search/filter/group/AI result set); callers pass stable/memoized arrays.
export function useInfiniteScroll<T>(items: T[], pageSize = 12) {
  const [count, setCount] = useState(pageSize);
  const [prevItems, setPrevItems] = useState(items);
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // New result set → back to the first page, and require a fresh scroll before
  // auto-loading again. Adjusting state during render (per React's "you might not
  // need an effect" guidance) re-renders immediately with the reset window.
  if (items !== prevItems) {
    setPrevItems(items);
    setCount(pageSize);
    setScrolled(false);
  }

  const hasMore = count < items.length;

  // Remember once the user has scrolled. Set up once; persists across loads.
  useEffect(() => {
    const onScroll = () => setScrolled(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!hasMore) return;
    if (typeof IntersectionObserver === "undefined") return; // SSR / old browsers
    const el = sentinelRef.current;
    if (!el) return;

    const loadNext = () =>
      setCount((c) => Math.min(c + pageSize, items.length));

    // Page can't scroll yet → the remaining items are unreachable. Fill instead
    // of waiting for a scroll that can't happen. (Effect re-runs on `count`, so
    // this keeps filling until the page becomes scrollable or runs out.)
    if (document.documentElement.scrollHeight <= window.innerHeight) {
      loadNext();
      return;
    }

    // Otherwise, wait for the user to scroll before auto-loading the next page.
    if (!scrolled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNext();
      },
      // Load the next page slightly before the sentinel is on screen.
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, items.length, pageSize, count, scrolled]);

  return { visible: items.slice(0, count), hasMore, sentinelRef };
}
