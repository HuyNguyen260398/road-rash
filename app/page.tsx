import AppShell from "@/components/AppShell";
import LandingHero from "@/components/LandingHero";
import TrendingTrips from "@/components/TrendingTrips";
import HowItWorks from "@/components/HowItWorks";
import FeatureHighlights from "@/components/FeatureHighlights";
import LandingCta from "@/components/LandingCta";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import { api } from "@/lib/api-client";
import { selectTrending } from "@/lib/trending";
import type { Trip } from "@/lib/types";

// Marketing landing page (home). Public, server-rendered: fetch trips for the
// live count + a "trending" strip, then compose the static sections. The browse
// experience lives at /discover. Fetch failures degrade gracefully — the hero
// shows a static label and TrendingTrips renders nothing for an empty set.
export const dynamic = "force-dynamic";

export default async function Home() {
  let trips: Trip[] = [];

  try {
    const result = await api.getTrips();
    trips = result.trips;
  } catch {
    // API not reachable/configured yet (e.g. before terraform apply) — render
    // the static landing shell rather than crashing.
  }

  const trending = selectTrending(trips, 6);

  return (
    <AppShell>
      <LandingHero tripCount={trips.length} />
      <TrendingTrips trips={trending} />
      <HowItWorks />
      <FeatureHighlights />
      <LandingCta />
      <ScrollToTopButton />
    </AppShell>
  );
}
