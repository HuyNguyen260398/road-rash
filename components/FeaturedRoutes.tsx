"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { REDUCED_MOTION_QUERY } from "@/lib/motion";
import TripCard from "@/components/TripCard";
import type { Trip } from "@/lib/types";

// "Featured routes" — an auto-scrolling marquee of the community's most-loved
// trips on a single row. The track holds two identical copies of the list and
// slides to -50%, so copy B lands exactly where copy A started and the loop is
// seamless (the classic GSAP marquee trick). It pauses on hover and on keyboard
// focus, and for reduced-motion users the auto-scroll is skipped entirely in
// favour of a normal horizontal scroll (the duplicate copy is hidden and the row
// becomes overflow-x-auto via the motion-reduce:* utilities).

// Seconds for one card to traverse — keeps the scroll speed constant no matter
// how many trips are featured (total duration scales with the card count).
const SECONDS_PER_CARD = 5;

export default function FeaturedRoutes({ trips }: { trips: Trip[] }) {
  const t = useTranslations("landing.featuredRoutes");
  const root = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<GSAPTween | null>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        const track = trackRef.current;
        if (!track) return;
        const tween = gsap.to(track, {
          xPercent: -50,
          ease: "none",
          duration: trips.length * SECONDS_PER_CARD,
          repeat: -1,
        });
        tweenRef.current = tween;
        return () => {
          tween.kill();
          tweenRef.current = null;
        };
      });
    },
    { scope: root, dependencies: [trips.length] },
  );

  const pause = () => tweenRef.current?.pause();
  const resume = () => tweenRef.current?.play();

  if (trips.length === 0) return null;

  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-6 sm:px-6 lg:px-8">
        <header className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t("title")}</h2>
          <Link
            href="/discover"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {t("viewAll")}
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </header>
      </div>

      {/* Full-bleed marquee row. Pauses on hover and when a card receives keyboard
          focus; reduced-motion users get a static, scrollable row instead. */}
      <div
        ref={root}
        className="relative mx-auto w-4/5 overflow-hidden pb-16 motion-reduce:overflow-x-auto"
        onPointerEnter={pause}
        onPointerLeave={resume}
        onFocusCapture={pause}
        onBlurCapture={resume}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent sm:w-24"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent sm:w-24"
        />

        <div ref={trackRef} className="flex w-max">
          {trips.map((trip) => (
            <div key={`a-${trip.id}`} className="w-72 shrink-0 px-2.5 sm:w-80">
              <TripCard trip={trip} />
            </div>
          ))}
          {/* Duplicate copy enables the seamless loop; hidden from assistive tech
              and removed entirely for reduced-motion users. */}
          {trips.map((trip) => (
            <div
              key={`b-${trip.id}`}
              aria-hidden
              className="w-72 shrink-0 px-2.5 motion-reduce:hidden sm:w-80"
            >
              <TripCard trip={trip} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
