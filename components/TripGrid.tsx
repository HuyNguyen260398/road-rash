"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { revealFrom, revealTo, REDUCED_MOTION_QUERY } from "@/lib/motion";
import TripCard from "./TripCard";
import TripCardSkeleton from "./TripCardSkeleton";
import TripDetailModal from "./TripDetailModal";
import EmptyState from "./EmptyState";
import LoadMoreIndicator from "./LoadMoreIndicator";
import { Badge } from "@/components/ui/badge";
import { useInfiniteScroll } from "@/lib/use-infinite-scroll";
import { useCardReveal } from "@/lib/use-card-reveal";
import type { Trip } from "@/lib/types";

// Responsive, mobile-first card grid (TASK-027 / REQ-001): 1 column on phones,
// scaling up to 4 on wide screens. When `groups` is provided (TASK-036) it
// renders each group under a section header instead of one flat grid.
//
// Tapping a card opens the shared TripDetailModal (TASK-046); the same content
// is reachable at /trip/[id] for deep links and shares.

export type TripGridGroup = { label: string; trips: Trip[] };

// Responsive grid wrapper shared by the real cards and the skeleton placeholders
// so the swap between them is seamless.
const GRID_CLASS =
  "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

// Cap the per-card stagger so large grids don't drag: cards past this index all
// share the final delay and animate in together.
const STAGGER_CAP = 11;
const STAGGER_STEP_MS = 55;

function Cards({
  trips,
  onOpen,
  animate,
  reveal,
}: {
  trips: Trip[];
  onOpen: (trip: Trip, rect: DOMRect) => void;
  /** Fade/float each card in on mount (only newly added cards re-animate),
      cascading via a per-card animation-delay. */
  animate?: boolean;
  /** Stamp `data-reveal` so ScrollTrigger can reveal the card on scroll
      (used by grouped sections instead of the on-mount CSS float-up). */
  reveal?: boolean;
}) {
  return (
    <div className={GRID_CLASS}>
      {trips.map((trip, i) => (
        <TripCard
          key={trip.id}
          trip={trip}
          onOpen={onOpen}
          data-reveal={reveal ? "" : undefined}
          className={animate ? "animate-float-up" : undefined}
          style={
            animate
              ? {
                  animationDelay: `${Math.min(i, STAGGER_CAP) * STAGGER_STEP_MS}ms`,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}

// Shimmer placeholders shown during the brief loading phase (TASK: AWS-style card
// loading effect) on initial render and whenever search/filter/group changes.
function SkeletonCards({ count }: { count: number }) {
  return (
    <div className={GRID_CLASS} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <TripCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Flat card grid that reveals 12 trips at a time, auto-loading the next batch as
// the sentinel scrolls into view (used for the ungrouped list; grouped sections
// render in full).
function PaginatedCards({
  trips,
  onOpen,
}: {
  trips: Trip[];
  onOpen: (trip: Trip, rect: DOMRect) => void;
}) {
  const { visible, hasMore, loading, sentinelRef } = useInfiniteScroll(trips);
  return (
    <>
      <Cards trips={visible} onOpen={onOpen} animate />
      {hasMore ? (
        <LoadMoreIndicator sentinelRef={sentinelRef} loading={loading} />
      ) : null}
    </>
  );
}

// Grouped sections render all cards at once, so we reveal each card as it enters
// the viewport (ScrollTrigger.batch) rather than letting the CSS float-up fire on
// mount for cards far below the fold. Reduced-motion users see them immediately.
function RevealGroups({
  groups,
  onOpen,
}: {
  groups: TripGridGroup[];
  onOpen: (trip: Trip, rect: DOMRect) => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        const cards = gsap.utils.toArray<HTMLElement>(
          root.current!.querySelectorAll("[data-reveal]"),
        );
        gsap.set(cards, revealFrom());
        ScrollTrigger.batch(cards, {
          start: "top 90%",
          onEnter: (batch) =>
            gsap.to(batch, { ...revealTo(), stagger: 0.06, overwrite: true }),
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="flex flex-col gap-10">
      {groups.map((group) => (
        <section key={group.label}>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xl font-semibold">{group.label}</h2>
            <Badge variant="outline" className="bg-background">
              {group.trips.length}
            </Badge>
          </div>
          <Cards trips={group.trips} onOpen={onOpen} reveal />
        </section>
      ))}
    </div>
  );
}

export default function TripGrid({
  trips,
  groups,
  emptyMessage,
}: {
  trips: Trip[];
  groups?: TripGridGroup[];
  emptyMessage?: string;
}) {
  const t = useTranslations("empty");
  const [selected, setSelected] = useState<{
    trip: Trip;
    rect: DOMRect;
  } | null>(null);
  const openTrip = (trip: Trip, rect: DOMRect) => setSelected({ trip, rect });

  const total = groups
    ? groups.reduce((n, g) => n + g.trips.length, 0)
    : trips.length;

  // Loading→reveal phase keyed on the current result set: changes to the trips
  // array or the groups array (search, filter, group) flash skeletons, then the
  // real cards float in.
  const phase = useCardReveal(groups ?? trips);

  let body;
  if (total === 0) {
    body = <EmptyState title={emptyMessage ?? t("noTripsYet")} />;
  } else if (phase === "loading") {
    body = <SkeletonCards count={Math.min(total, 8)} />;
  } else if (groups) {
    body = <RevealGroups groups={groups} onOpen={openTrip} />;
  } else {
    body = <PaginatedCards trips={trips} onOpen={openTrip} />;
  }

  return (
    <>
      {body}
      {selected ? (
        <TripDetailModal
          trip={selected.trip}
          sourceRect={selected.rect}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
