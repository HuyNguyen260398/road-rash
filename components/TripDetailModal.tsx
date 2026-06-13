"use client";

import { useEffect } from "react";
import { XIcon } from "lucide-react";
import TripDetail from "./TripDetail";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Trip } from "@/lib/types";

// Trip detail modal (TASK-043). Thin chrome — overlay, close button, Esc-to-close
// and scroll lock — around the shared <TripDetail> content. The same content
// renders on the public /trip/[id] share page for deep links (TASK-046).

export default function TripDetailModal({
  trip,
  onClose,
}: {
  trip: Trip;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the modal is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={trip.name}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <Card
        className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto shadow-2xl sm:max-h-[calc(100dvh-4rem)]"
        // Clicks inside the card must not bubble to the overlay's close handler.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex justify-end bg-card/90 p-3 backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close trip details"
            className="size-9"
          >
            <XIcon aria-hidden />
          </Button>
        </div>
        <div className="-mt-3">
          <TripDetail key={trip.id} trip={trip} />
        </div>
      </Card>
    </div>
  );
}
