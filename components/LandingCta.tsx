"use client";

import Link from "next/link";
import { useFavorites } from "@/components/FavoritesProvider";
import { buttonVariants } from "@/components/ui/button";

// Closing CTA. Mirrors the hero: a background image with a dark overlay and
// white text, and the same browse-first dual CTA buttons (default primary +
// outline). The secondary action swaps to "Create a trip" once signed in (state
// from FavoritesProvider). The slow zoom (.hero-kenburns) is reduced-motion safe
// via globals.css.
export default function LandingCta() {
  const { signedIn } = useFavorites();

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div
          className="hero-kenburns absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/cta-sunset-road.jpg')" }}
        />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/70 to-black/60"
      />
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
        <h2 className="text-3xl font-semibold text-balance text-white sm:text-4xl">
          Your next route is waiting
        </h2>
        <p className="max-w-2xl text-lg text-white/85">
          Browse community trips or share your own map-backed plan — it only
          takes a My Maps link.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/discover" className={buttonVariants({ size: "lg" })}>
            Explore trips
          </Link>
          <Link
            href={signedIn ? "/trips/new" : "/login"}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {signedIn ? "Create a trip" : "Sign in to share yours"}
          </Link>
        </div>
      </div>
    </section>
  );
}
