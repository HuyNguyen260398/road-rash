"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useFavorites } from "@/components/FavoritesProvider";
import { buttonVariants } from "@/components/ui/button";

// Closing CTA. Mirrors the hero: a background image with a dark overlay and
// white text, and the same browse-first dual CTA buttons (default primary +
// outline). The secondary action swaps to "Create a trip" once signed in (state
// from FavoritesProvider). The slow zoom (.hero-kenburns) is reduced-motion safe
// via globals.css.
export default function LandingCta() {
  const { signedIn } = useFavorites();
  const t = useTranslations("landing.cta");

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
          {t("title")}
        </h2>
        <p className="max-w-2xl text-lg text-white/85">{t("body")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/discover" className={buttonVariants({ size: "lg" })}>
            {t("ctaPrimary")}
          </Link>
          <Link
            href={signedIn ? "/trips/new" : "/login"}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {signedIn ? t("ctaSecondarySignedIn") : t("ctaSecondarySignedOut")}
          </Link>
        </div>
      </div>
    </section>
  );
}
