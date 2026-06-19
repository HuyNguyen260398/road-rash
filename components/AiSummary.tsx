"use client";

import { useTranslations } from "next-intl";
import { SparklesIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Dismissible "AI says" card shown between the search bar and the trip grid.
// TripBrowser owns the state and only mounts this when there is something to
// show (loading, a summary, or a fallback message).
export default function AiSummary({
  loading,
  summary,
  message,
  onDismiss,
}: {
  loading: boolean;
  summary: string | null;
  message: string | null;
  onDismiss: () => void;
}) {
  const t = useTranslations("search");

  const body = loading ? t("aiSummaryLoading") : (summary ?? message ?? "");

  return (
    <div className="flex animate-float-up items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      {/* While thinking the sparkle "breathes" (pulse) in place of a spinner,
          keeping the AI identity in the icon instead of a title. */}
      <SparklesIcon
        className={`mt-0.5 size-4 shrink-0 text-primary ${loading ? "animate-pulse" : ""}`}
        aria-hidden
      />
      <div className="flex-1">
        {/* No "AI suggestion" title in any state — the sparkle icon carries the
            AI identity; the text stands on its own (summary, "Thinking…", or a
            fallback message). */}
        <p
          aria-live="polite"
          className={`text-sm ${loading ? "animate-pulse text-muted-foreground" : "text-foreground"}`}
        >
          {body}
        </p>
      </div>
      {!loading ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          aria-label={t("aiSummaryDismiss")}
          onClick={onDismiss}
        >
          <XIcon className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
