"use client";

import { useState } from "react";
import TripCard from "./TripCard";
import TripDetailModal from "./TripDetailModal";
import EmptyState from "./EmptyState";
import { Badge } from "@/components/ui/badge";
import type { Trip } from "@/lib/types";

// Responsive, mobile-first card grid (TASK-027 / REQ-001): 1 column on phones,
// scaling up to 4 on wide screens. When `groups` is provided (TASK-036) it
// renders each group under a section header instead of one flat grid.
//
// Tapping a card opens the shared TripDetailModal (TASK-046); the same content
// is reachable at /trip/[id] for deep links and shares.

export type TripGridGroup = { label: string; trips: Trip[] };

function Cards({
  trips,
  onOpen,
}: {
  trips: Trip[];
  onOpen: (trip: Trip) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} onOpen={onOpen} />
      ))}
    </div>
  );
}

export default function TripGrid({
  trips,
  groups,
  emptyMessage = "No trips yet.",
}: {
  trips: Trip[];
  groups?: TripGridGroup[];
  emptyMessage?: string;
}) {
  const [selected, setSelected] = useState<Trip | null>(null);

  const total = groups
    ? groups.reduce((n, g) => n + g.trips.length, 0)
    : trips.length;

  let body;
  if (total === 0) {
    body = <EmptyState title={emptyMessage} />;
  } else if (groups) {
    body = (
      <div className="flex flex-col gap-10">
        {groups.map((group) => (
          <section key={group.label}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xl font-semibold">{group.label}</h2>
              <Badge variant="outline" className="bg-background">
                {group.trips.length}
              </Badge>
            </div>
            <Cards trips={group.trips} onOpen={setSelected} />
          </section>
        ))}
      </div>
    );
  } else {
    body = <Cards trips={trips} onOpen={setSelected} />;
  }

  return (
    <>
      {body}
      {selected ? (
        <TripDetailModal trip={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}
