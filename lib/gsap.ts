// Runtime gsap surface: the single place that imports gsap + plugins and
// registers them exactly once. Components import { gsap } from here (never from
// "gsap" directly) so registration is guaranteed before use.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

/** Idempotent — safe to call from every island and from GsapProvider. */
export function registerGsap(): void {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export { gsap, ScrollTrigger };
