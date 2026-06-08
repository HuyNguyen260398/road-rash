import { notFound, redirect } from "next/navigation";
import TripForm from "@/components/TripForm";
import { getServerSession } from "@/lib/server-session";
import { api, ApiError } from "@/lib/api-client";

// Owner-gated edit page (TASK-026). Three gates: signed in, trip exists, and
// caller owns it. The trips Lambda enforces the same ownership check (403), so
// this server guard is UX, not the security boundary.
export const dynamic = "force-dynamic";

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession();
  if (!session) redirect("/login");

  let trip;
  try {
    trip = await api.getTrip(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Non-owners can't edit — bounce them to the (public) detail view (M4).
  if (trip.authorId !== session.sub) redirect(`/trip/${id}`);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Edit trip</h1>
      <TripForm trip={trip} />
    </main>
  );
}
