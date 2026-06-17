"use client";

import type { RefObject } from "react";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

// The infinite-scroll trigger: an element the hook's IntersectionObserver watches,
// which also shows a brief "Loading…" state while the next page is being revealed.
export default function LoadMoreIndicator({
  sentinelRef,
  loading,
}: {
  sentinelRef: RefObject<HTMLDivElement | null>;
  loading: boolean;
}) {
  const t = useTranslations("search");
  return (
    <div
      ref={sentinelRef}
      aria-live="polite"
      className="flex h-12 items-center justify-center"
    >
      {loading ? (
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          {t("loadMore")}
        </span>
      ) : null}
    </div>
  );
}
