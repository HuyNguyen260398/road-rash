import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { AlertTriangleIcon, RouteIcon } from "lucide-react";
import AppShell from "@/components/AppShell";
import TripGrid from "@/components/TripGrid";
import EmptyState from "@/components/EmptyState";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import { buttonVariants } from "@/components/ui/button";
import { getServerSession } from "@/lib/server-session";
import { api } from "@/lib/api-client";
import type { Trip } from "@/lib/types";

// Auth-gated "My trips" (TASK-028): trips authored by the current user. Until
// the author GSI/query lands (M5) this filters the full list by sub server-side.
export const dynamic = "force-dynamic";

export default async function MyTripsPage() {
  const t = await getTranslations("pages.myTrips");
  const tCommon = await getTranslations("pages.common");
  const session = await getServerSession();
  if (!session) return redirect({ href: "/login", locale: await getLocale() });

  let mine: Trip[] = [];
  let loadError: string | null = null;
  try {
    const { trips } = await api.getTrips();
    mine = trips.filter((t) => t.authorId === session.sub);
  } catch {
    loadError = tCommon("loadError");
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <RouteIcon className="size-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("subtitle")}
              </p>
            </div>
          </div>
          <Link href="/trips/new" className={buttonVariants()}>
            {t("createTrip")}
          </Link>
        </header>

        {loadError ? (
          <EmptyState
            icon={<AlertTriangleIcon className="size-6" aria-hidden />}
            title={t("loadErrorTitle")}
            description={loadError}
          />
        ) : mine.length === 0 ? (
          <EmptyState
            icon={<RouteIcon className="size-6" aria-hidden />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <Link href="/trips/new" className={buttonVariants()}>
                {t("createTrip")}
              </Link>
            }
          />
        ) : (
          <TripGrid trips={mine} />
        )}
      </div>
      <ScrollToTopButton />
    </AppShell>
  );
}
