"use client";

import { useRef } from "react";
import { MapIcon, LinkIcon, Share2Icon, type LucideIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import {
  revealFrom,
  revealTo,
  STAGGER,
  REDUCED_MOTION_QUERY,
} from "@/lib/motion";

// The My Maps workflow, stated up front. Google My Maps has no public API, so
// the user builds the map by hand and pastes the share link — these three steps
// set that expectation before someone tries to create a trip.
//
// Motion (AWS "Browse Solutions"-style): the three panels fade + rise into view
// as the section scrolls in, staggered; on hover each panel lifts with a deeper
// shadow, an accent border, and a filled icon tile. The scroll reveal only runs
// for users who allow motion (reduced-motion users see the panels in place); the
// hover lift is gated to motion-safe so the shadow/border/colour cues still
// apply without the movement.
const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MapIcon,
    title: "Build your route in Google My Maps",
    body: "Drop pins, draw your route, and add stops in the My Maps editor you already know.",
  },
  {
    icon: LinkIcon,
    title: "Paste the share link",
    body: "Copy your My Maps share link into the trip form, then add the details: vehicle, duration, and where it goes.",
  },
  {
    icon: Share2Icon,
    title: "Share & discover",
    body: "Publish your trip for the community and explore map-backed routes other riders have shared.",
  },
];

export default function HowItWorks() {
  const root = useRef<HTMLElement>(null);

  // Staggered fade-up reveal as the section scrolls into view (same
  // ScrollTrigger.batch pattern as the trip grid). The hover lift itself is CSS
  // on an inner element, so it never fights this GSAP transform on the <li>.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        const cards = gsap.utils.toArray<HTMLElement>(
          root.current!.querySelectorAll(".hiw-card"),
        );
        gsap.set(cards, revealFrom());
        ScrollTrigger.batch(cards, {
          start: "top 85%",
          onEnter: (batch) =>
            gsap.to(batch, {
              ...revealTo(),
              stagger: STAGGER.base,
              overwrite: true,
            }),
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="bg-muted">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
          <p className="mt-2 text-muted-foreground">
            Road Rash is built around the Google My Maps you already make —
            three steps from idea to a shared trip.
          </p>
        </header>
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="hiw-card list-none">
              <div className="group h-full rounded-lg border border-border bg-card p-6 shadow-sm transition-[transform,box-shadow,border-color] duration-300 ease-out hover:border-primary/40 hover:shadow-lg motion-safe:hover:-translate-y-1.5">
                <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" aria-hidden />
                </div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  Step {i + 1}
                </p>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
