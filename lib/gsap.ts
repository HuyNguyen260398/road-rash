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

// Register eagerly at module load on the client. `useGSAP` runs as a layout
// effect, which fires before GsapProvider's passive effect — so registering in
// an effect is too late for components that use ScrollTrigger on mount. Any
// client island that touches gsap imports this module, so this always runs first.
registerGsap();

export { gsap, ScrollTrigger };
