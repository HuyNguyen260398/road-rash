"use client";

import { useEffect, useRef, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="relative">
      <label htmlFor="trip-search" className="sr-only">
        Search trips
      </label>
      <SearchIcon
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id="trip-search"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-11 pl-9 pr-11"
      />
      {text ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear trip search"
          className="absolute right-1 top-1/2 size-9 -translate-y-1/2"
          onClick={() => setText("")}
        >
          <XIcon aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
