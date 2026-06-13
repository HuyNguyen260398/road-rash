"use client";

import type { ReactNode } from "react";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <AppHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
