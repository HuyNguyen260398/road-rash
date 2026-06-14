"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Floating "back to top" button for long trip lists. Appears once the user has
// scrolled past the first batch of trips and smooth-scrolls them back up. Renders
// nothing until the threshold is crossed, so short lists never show it.
export default function ScrollToTopButton({
  threshold = 600,
}: {
  threshold?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll(); // sync in case the page is already scrolled (e.g. on back-nav)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-40 size-11 rounded-full border border-border shadow-lg"
    >
      <ArrowUpIcon className="size-5" aria-hidden />
    </Button>
  );
}
