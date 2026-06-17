"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { XIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { DURATION, EASE, REDUCED_MOTION_QUERY } from "@/lib/motion";
import TripDetail from "./TripDetail";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Trip } from "@/lib/types";

// Trip detail modal (TASK-043). The card grows from the tapped card's screen
// position (sourceRect) on open and shrinks back on close; reduced-motion users
// get an instant open/close. Esc + overlay click play the exit, then unmount.
// The same content renders on the public /trip/[id] share page (TASK-046).

export default function TripDetailModal({
  trip,
  sourceRect,
  onClose,
}: {
  trip: Trip;
  sourceRect?: DOMRect;
  onClose: () => void;
}) {
  const t = useTranslations("trip");
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const animate = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    if (!animate || !cardRef.current || !overlayRef.current) {
      onClose();
      return;
    }
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(
      cardRef.current,
      { autoAlpha: 0, scale: 0.92, duration: DURATION.fast, ease: EASE.inOut },
      0,
    ).to(overlayRef.current, { autoAlpha: 0, duration: DURATION.fast }, 0);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the modal is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [close]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        gsap.from(overlayRef.current, {
          autoAlpha: 0,
          duration: DURATION.fast,
          ease: EASE.out,
        });
        const card = cardRef.current!;
        const cr = card.getBoundingClientRect();
        let fromVars: gsap.TweenVars = {
          autoAlpha: 0,
          scale: 0.92,
          transformOrigin: "center center",
        };
        if (sourceRect) {
          // Anchor the grow-from origin at the clicked card's centre.
          const originX =
            ((sourceRect.left + sourceRect.width / 2 - cr.left) / cr.width) *
            100;
          const originY =
            ((sourceRect.top + sourceRect.height / 2 - cr.top) / cr.height) *
            100;
          fromVars = {
            autoAlpha: 0,
            scale: Math.max(0.2, sourceRect.width / cr.width),
            transformOrigin: `${originX}% ${originY}%`,
          };
        }
        gsap.from(card, {
          ...fromVars,
          duration: DURATION.base,
          ease: EASE.out,
        });
        gsap.from(card.querySelectorAll("[data-stagger]"), {
          autoAlpha: 0,
          y: 12,
          duration: DURATION.base,
          ease: EASE.out,
          stagger: 0.06,
          delay: 0.08,
        });
      });
    },
    { scope: overlayRef },
  );

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={trip.name}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8"
      onClick={close}
    >
      <Card
        ref={cardRef}
        className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto shadow-2xl sm:max-h-[calc(100dvh-4rem)]"
        // Clicks inside the card must not bubble to the overlay's close handler.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex justify-end bg-card/90 p-3 backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label={t("close")}
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
