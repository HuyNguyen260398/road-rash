"use client";

import { useEffect, useRef, useState } from "react";

// Debounced free-text search input driving the `q` filter (TASK-034 / REQ-008).
// The debounce keeps plain client-side filtering responsive without re-running
// on every keystroke. AI suggestions are submit-only and live in M6 (CON-003) —
// this input never triggers an AI call.

export default function SearchBar({
  defaultValue = "",
  onChange,
  delay = 250,
  placeholder = "Search trips…",
}: {
  defaultValue?: string;
  onChange: (q: string) => void;
  delay?: number;
  placeholder?: string;
}) {
  const [text, setText] = useState(defaultValue);
  const firstRender = useRef(true);

  useEffect(() => {
    // Skip the initial mount so we don't fire onChange with the default value.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = setTimeout(() => onChange(text), delay);
    return () => clearTimeout(id);
  }, [text, delay, onChange]);

  return (
    <input
      type="search"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder={placeholder}
      aria-label="Search trips"
      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/20"
    />
  );
}
