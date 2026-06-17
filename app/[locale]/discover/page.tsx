import { getTranslations } from "next-intl/server";
import { AlertTriangleIcon } from "lucide-react";
import AppShell from "@/components/AppShell";
import TripBrowser from "@/components/TripBrowser";
import EmptyState from "@/components/EmptyState";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import { api } from "@/lib/api-client";
import type { Trip } from "@/lib/types";

// Discover (browse) page. Public, server-rendered: fetch all trips and hand them
// to the client TripBrowser, which runs instant search/filter/group (M5). Moved
// here from the home route when `/` became the marketing landing page; the big
// image hero was replaced by the slim header below.
export const dynamic = "force-dynamic";

export default async function Discover() {
  const t = await getTranslations("pages.discover");
  const tCommon = await getTranslations("pages.common");
  let trips: Trip[] = [];
  let loadError: string | null = null;

  try {
    const result = await api.getTrips();
    trips = result.trips;
  } catch {
    // API not reachable/configured yet — render the shell with an empty grid
    // rather than crashing.
    loadError = tCommon("loadError");
  }

  return (
    <AppShell>
      <section className="border-b border-border bg-muted">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("subtitle", { count: trips.length })}
          </p>
        </div>
      </section>
      <section id="trip-browser" className="bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          {loadError ? (
            <EmptyState
              icon={<AlertTriangleIcon className="size-6" aria-hidden />}
              title={t("unavailableTitle")}
              description={loadError}
            />
          ) : (
            <TripBrowser
              trips={trips}
              emptyMessage={t("emptyMessage")}
            />
          )}
        </div>
      </section>
      <ScrollToTopButton />
    </AppShell>
  );
}
