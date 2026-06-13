"use client";

import { type FormEvent } from "react";
import { SearchIcon, SparklesIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// One control for both modes: typing drives instant plain search (onChange),
// and the inline "Ask AI" button submits the same text for AI ranking
// (submit-only — never per-keystroke, per CON-003). The parent (TripBrowser)
// owns the value and decides which result set to render.

export default function SearchPill({
  value,
  onChange,
  onAskAi,
  onClear,
  loading,
  aiActive,
  aiDisabled = false,
}: {
  value: string;
  onChange: (q: string) => void;
  onAskAi: () => void;
  onClear: () => void;
  loading: boolean;
  aiActive: boolean;
  // True when there are no candidate trips to rank — keeps the Ask AI button
  // from firing a pointless request against an empty set.
  aiDisabled?: boolean;
}) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || aiDisabled || !value.trim()) return;
    onAskAi();
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <label htmlFor="trip-search" className="sr-only">
        Search trips or describe your ride
      </label>
      <SearchIcon
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      {/* type="text" (not "search") so the native WebKit clear button — which
          mutates the field without firing React's onChange — can't desync the
          value from `q`. The custom clear button below is the single reset. */}
      <Input
        id="trip-search"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search trips, or describe your ride…"
        className="h-12 pl-9 pr-44"
      />
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {(value || aiActive) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            className="size-9"
            onClick={onClear}
          >
            <XIcon aria-hidden />
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={loading || aiDisabled || !value.trim()}
          className="gap-1.5"
        >
          <SparklesIcon aria-hidden />
          {loading ? "Asking…" : "Ask AI"}
        </Button>
      </div>
    </form>
  );
}
