"use client";

import { useEffect, useRef, useState } from "react";

// Client-side pagination for an already-loaded list. Renders the first `pageSize`
// items and grows the visible window by `pageSize` each time the returned
// `sentinelRef` element scrolls near the viewport — an auto "load more" with no
// button. The full dataset is already in memory (no API calls), so this is purely
// a render-window concern.
//
// The window resets to `pageSize` whenever `items` changes identity (a new
// search/filter/group/AI result set); callers pass stable/memoized arrays.
export function useInfiniteScroll<T>(items: T[], pageSize = 12) {
  const [count, setCount] = useState(pageSize);
  const [prevItems, setPrevItems] = useState(items);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // New result set → back to the first page. Adjusting state during render (per
  // React's "you might not need an effect" guidance) re-renders immediately with
  // the reset window, avoiding a flash of the previous list's extra pages.
  if (items !== prevItems) {
    setPrevItems(items);
    setCount(pageSize);
  }

  const hasMore = count < items.length;

  useEffect(() => {
    if (!hasMore) return;
    if (typeof IntersectionObserver === "undefined") return; // SSR / old browsers
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setCount((c) => Math.min(c + pageSize, items.length));
        }
      },
      // Load the next page slightly before the sentinel is on screen.
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, items.length, pageSize]);

  return { visible: items.slice(0, count), hasMore, sentinelRef };
}
