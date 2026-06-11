import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import TripDetail from "@/components/TripDetail";
import { api, ApiError } from "@/lib/api-client";
import type { Trip } from "@/lib/types";

// Public, server-rendered share page (TASK-046). Renders the same TripDetail
// content as the modal so deep links and shared URLs work standalone. Full OG
// metadata + the favorites surface are part of M4 (TASK-032); this is the
// minimal route the M7 modal wiring depends on.
export const dynamic = "force-dynamic";

async function loadTrip(id: string): Promise<Trip> {
  try {
    return await api.getTrip(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const trip = await api.getTrip(id);
    return {
      title: `${trip.name} · road-rash`,
      description: trip.description ?? `A trip plan by ${trip.authorName}.`,
    };
  } catch {
    return { title: "Trip · road-rash" };
  }
}

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await loadTrip(id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/" className="text-sm opacity-70 hover:underline">
        ← Back to trips
      </Link>
      <div className="mt-4 overflow-hidden rounded-xl border border-black/10 dark:border-white/15">
        <TripDetail trip={trip} />
      </div>
    </main>
  );
}
