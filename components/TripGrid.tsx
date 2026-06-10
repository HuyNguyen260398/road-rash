import TripCard from "./TripCard";
import type { Trip } from "@/lib/types";

// Responsive, mobile-first card grid (TASK-027 / REQ-001): 1 column on phones,
// scaling up to 4 on wide screens. When `groups` is provided (TASK-036) it
// renders each group under a section header instead of one flat grid.

export type TripGridGroup = { label: string; trips: Trip[] };

function Cards({ trips }: { trips: Trip[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
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
  const total = groups
    ? groups.reduce((n, g) => n + g.trips.length, 0)
    : trips.length;

  if (total === 0) {
    return <p className="py-16 text-center opacity-60">{emptyMessage}</p>;
  }

  if (groups) {
    return (
      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-3 text-lg font-semibold">
              {group.label}{" "}
              <span className="text-sm font-normal opacity-50">
                ({group.trips.length})
              </span>
            </h2>
            <Cards trips={group.trips} />
          </section>
        ))}
      </div>
    );
  }

  return <Cards trips={trips} />;
}
