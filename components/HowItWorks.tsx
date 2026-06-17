"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
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
// Icons stay in code (paired by index with the translated copy in messages).
const STEP_ICONS: LucideIcon[] = [MapIcon, LinkIcon, Share2Icon];

export default function HowItWorks() {
  const t = useTranslations("landing.howItWorks");
  const steps = t.raw("steps") as { title: string; body: string }[];
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
        <header className="mb-10">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t("title")}</h2>
        </header>
        <ol className="grid gap-6 sm:grid-cols-3">
          {steps.map(({ title, body }, i) => {
            const Icon = STEP_ICONS[i];
            return (
            <li key={title} className="hiw-card list-none">
              <div className="group h-full rounded-lg border border-border bg-card p-6 shadow-sm transition-[transform,box-shadow,border-color] duration-300 ease-out hover:border-primary/40 hover:shadow-lg motion-safe:hover:-translate-y-1.5">
                <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" aria-hidden />
                </div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  {t("stepLabel", { number: i + 1 })}
                </p>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
