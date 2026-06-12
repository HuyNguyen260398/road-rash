import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import TripDetail from "@/components/TripDetail";
import { api, ApiError } from "@/lib/api-client";
import type { Trip } from "@/lib/types";

// Public, server-rendered share page (TASK-046 / TASK-032). Renders the same
// TripDetail content as the modal so deep links and shared URLs work standalone,
// and emits Open Graph metadata so a shared link previews with the trip name +
// thumbnail. The favorites heart lives on the cards (TripCard), not here.
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
    const description =
      trip.description ?? `A trip plan by ${trip.authorName}.`;

    // Best-effort OG image: the thumbnail bucket is private, so we mint a public
    // presigned GET (the same URL the cards use). It's time-limited, which is
    // fine for a crawler fetching the preview at share time.
    let images: string[] | undefined;
    if (trip.thumbnailKey) {
      try {
        const { url } = await api.getThumbnailUrl(trip.thumbnailKey);
        images = [url];
      } catch {
        // No preview image — the text card still renders.
      }
    }

    return {
      title: `${trip.name} · road-rash`,
      description,
      openGraph: {
        title: trip.name,
        description,
        type: "website",
        images,
      },
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
