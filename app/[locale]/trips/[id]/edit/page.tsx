import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import AppShell from "@/components/AppShell";
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
  const locale = await getLocale();

  const session = await getServerSession();
  if (!session) return redirect({ href: "/login", locale });

  let trip;
  try {
    trip = await api.getTrip(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Non-owners can't edit — bounce them to the (public) detail view (M4).
  if (trip.authorId !== session.sub)
    redirect({ href: `/trip/${id}`, locale });

  const t = await getTranslations("forms");

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <header className="mb-8 space-y-3">
          <Link
            href={`/trip/${id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            {t("backToTrip")}
          </Link>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{t("editPageTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("editPageSubtitle")}
            </p>
          </div>
        </header>
        <TripForm trip={trip} />
      </div>
    </AppShell>
  );
}
