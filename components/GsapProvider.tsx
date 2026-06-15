"use client";

import { useEffect } from "react";
import { registerGsap } from "@/lib/gsap";

// Registers gsap plugins once for the whole app. Renders nothing.
export default function GsapProvider() {
  useEffect(() => {
    registerGsap();
  }, []);
  return null;
}
