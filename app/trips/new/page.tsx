import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import TripForm from "@/components/TripForm";
import { getServerSession } from "@/lib/server-session";

// Auth-gated create page (TASK-026). Guests are redirected to sign in; the
// trips Lambda independently rejects an unauthenticated POST (defense in depth).
export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <header className="mb-8 space-y-2">
          <h1 className="text-2xl font-semibold">Create a trip</h1>
          <p className="text-sm text-muted-foreground">
            Publish a route for the community. Build the map in Google My Maps
            first, then add the details and links below.
          </p>
        </header>
        <TripForm />
      </div>
    </AppShell>
  );
}
