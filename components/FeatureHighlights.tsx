"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import {
  MapIcon,
  HeartIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import {
  revealFrom,
  revealTo,
  STAGGER,
  REDUCED_MOTION_QUERY,
} from "@/lib/motion";

// Motion mirrors the "How it works" section: the panels fade + rise into view on
// scroll (staggered), and on hover each lifts with a deeper shadow, an accent
// border, and a filled icon tile. This section's accent is `secondary` (its icon
// tiles are already secondary-tinted). Reveal runs only when motion is allowed;
// the hover lift is gated to motion-safe so reduced-motion users still get the
// shadow/border/colour cues without the movement.
// Icons stay in code (paired by index with the translated copy in messages).
const FEATURE_ICONS: LucideIcon[] = [MapIcon, HeartIcon, SparklesIcon];

export default function FeatureHighlights() {
  const t = useTranslations("landing.featureHighlights");
  const features = t.raw("items") as { title: string; body: string }[];
  const root = useRef<HTMLElement>(null);

  // Staggered fade-up reveal as the section scrolls in. The hover lift is CSS on
  // an inner element, so it never fights this GSAP transform on the card wrapper.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        const cards = gsap.utils.toArray<HTMLElement>(
          root.current!.querySelectorAll(".feature-card"),
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
    <section ref={root} className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t("title")}</h2>
        </header>
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map(({ title, body }, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
            <div key={title} className="feature-card">
              <div className="group h-full rounded-lg border border-border bg-card p-6 shadow-sm transition-[transform,box-shadow,border-color] duration-300 ease-out hover:border-secondary/40 hover:shadow-lg motion-safe:hover:-translate-y-1.5">
                <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-secondary/10 text-secondary transition-colors duration-300 group-hover:bg-secondary group-hover:text-secondary-foreground">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
