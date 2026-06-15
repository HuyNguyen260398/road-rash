"use client";

import { useRef } from "react";
import Link from "next/link";
import { MapIcon, SparklesIcon, UsersIcon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

type DiscoverHeroProps = {
  tripCount: number;
};

export default function DiscoverHero({ tripCount }: DiscoverHeroProps) {
  const stats = [
    {
      label: "Shared routes",
      value: tripCount.toLocaleString(),
      icon: MapIcon,
    },
    {
      label: "Map-backed plans",
      value: "My Maps",
      icon: UsersIcon,
    },
    {
      label: "AI discovery",
      value: "Prompt ready",
      icon: SparklesIcon,
    },
  ];

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

  return (
    <section ref={root} className="relative isolate overflow-hidden bg-muted">
      <div
        aria-hidden
        className="hero-bg absolute -inset-y-[12%] inset-x-0 -z-10"
      >
        <div
          className="hero-kenburns absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-road.jpg')" }}
        />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/65 to-black/45 lg:via-black/55 lg:to-black/20"
      />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-16">
        <div className="flex max-w-3xl flex-col justify-center gap-6">
          <Badge
            variant="outline"
            className="hero-stagger w-fit border-white/40 bg-white/10 text-white"
          >
            Community road trips
          </Badge>
          <div className="hero-stagger space-y-4">
            <h1 className="text-4xl leading-tight font-semibold text-balance text-white sm:text-5xl">
              Find ride-ready routes with maps, favorites, and AI suggestions.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-white/85">
              Browse real travel plans, save routes for later, and use AI to
              narrow the community map down to the trip you want to take next.
            </p>
          </div>
          <div className="hero-stagger flex flex-col gap-3 sm:flex-row">
            <Link href="/trips/new" className={buttonVariants({ size: "lg" })}>
              Create trip
            </Link>
            <Link
              href="#trip-browser"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Browse routes
            </Link>
          </div>
        </div>

        <div className="grid content-center gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {stats.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-background/80 p-4 shadow-sm backdrop-blur"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </div>
              <p className="text-2xl font-semibold">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
