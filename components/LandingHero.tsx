"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import {
  DURATION,
  EASE,
  STAGGER,
  REDUCED_MOTION_QUERY,
  revealFrom,
  parallaxTo,
} from "@/lib/motion";
import { useFavorites } from "@/components/FavoritesProvider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

// Landing hero (replaces DiscoverHero on the marketing home page). Dual CTA is
// browse-first: "Explore trips" -> /discover; the secondary CTA swaps to
// "Create a trip" once the visitor is signed in (state from FavoritesProvider,
// the app-wide auth source). Animation + reduced-motion guard reuse lib/motion,
// matching the old DiscoverHero so dark mode / scroll behavior stay consistent.
export default function LandingHero({ tripCount }: { tripCount: number }) {
  const { signedIn } = useFavorites();
  const t = useTranslations("landing.hero");
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        gsap.from(".hero-stagger", {
          ...revealFrom(),
          duration: DURATION.base,
          ease: EASE.out,
          stagger: STAGGER.base,
        });
        gsap.to(".hero-bg", {
          ...parallaxTo(12),
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      });
    },
    { scope: root },
  );

  const countLabel =
    tripCount > 0
      ? t("countLabel", { count: tripCount })
      : t("countLabelFallback");

  return (
    <section ref={root} className="relative isolate overflow-hidden bg-muted">
      <div
        aria-hidden
        className="hero-bg absolute inset-x-0 -inset-y-[12%] -z-10"
      >
        <div className="hero-kenburns hero-bg-image absolute inset-0 bg-cover bg-center" />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/65 to-black/45 lg:via-black/55 lg:to-black/30"
      />
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <Badge
          variant="outline"
          className="hero-stagger w-fit border-white/40 bg-white/10 text-white"
        >
          {countLabel}
        </Badge>
        <h1 className="hero-stagger max-w-3xl text-4xl leading-tight font-semibold text-balance text-white sm:text-5xl lg:text-6xl">
          {t("title")}
        </h1>
        <p className="hero-stagger max-w-2xl text-lg leading-8 text-white/85">
          {t("subtitle")}
        </p>
        <div className="hero-stagger flex flex-col gap-3 sm:flex-row">
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
        <p className="hero-stagger text-sm text-white/70">{t("footnote")}</p>
      </div>
    </section>
  );
}
