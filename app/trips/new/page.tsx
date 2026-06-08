import { redirect } from "next/navigation";
import TripForm from "@/components/TripForm";
import { getServerSession } from "@/lib/server-session";

// Auth-gated create page (TASK-026). Guests are redirected to sign in; the
// trips Lambda independently rejects an unauthenticated POST (defense in depth).
export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Create a trip</h1>
      <TripForm />
    </main>
  );
}
