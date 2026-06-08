import TripCard from "./TripCard";
import type { Trip } from "@/lib/types";

// Responsive, mobile-first card grid (TASK-027 / REQ-001): 1 column on phones,
// scaling up to 4 on wide screens.

export default function TripGrid({
  trips,
  emptyMessage = "No trips yet.",
}: {
  trips: Trip[];
  emptyMessage?: string;
}) {
  if (trips.length === 0) {
    return <p className="py-16 text-center opacity-60">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}
