"use client";

import Link from "next/link";
import { useFavorites } from "@/components/FavoritesProvider";
import { buttonVariants } from "@/components/ui/button";

// Closing CTA band. Mirrors the hero's browse-first dual CTA; the secondary
// action swaps to "Create a trip" once signed in (state from FavoritesProvider).
export default function LandingCta() {
  const { signedIn } = useFavorites();

  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold text-balance sm:text-4xl">
          Your next route is waiting
        </h2>
        <p className="max-w-2xl text-lg text-primary-foreground/90">
          Browse community trips or share your own map-backed plan — it only
          takes a My Maps link.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/discover"
            className={buttonVariants({ size: "lg", variant: "secondary" })}
          >
            Explore trips
          </Link>
          <Link
            href={signedIn ? "/trips/new" : "/login"}
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            {signedIn ? "Create a trip" : "Sign in to share yours"}
          </Link>
        </div>
      </div>
    </section>
  );
}
