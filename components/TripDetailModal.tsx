"use client";

import { useEffect } from "react";
import TripDetail from "./TripDetail";
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-2xl rounded-xl bg-background shadow-xl"
        // Clicks inside the card must not bubble to the overlay's close handler.
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-lg leading-none opacity-70 transition-opacity hover:opacity-100"
        >
          ✕
        </button>
        <TripDetail trip={trip} />
      </div>
    </div>
  );
}
