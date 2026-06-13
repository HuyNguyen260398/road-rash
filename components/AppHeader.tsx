"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";
import AppLogo from "@/components/AppLogo";
import ModeToggle from "@/components/ModeToggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Discover" },
  { href: "/saved", label: "Saved" },
  { href: "/my-trips", label: "My trips" },
] as const;

function navLinkClass(active: boolean) {
  return cn(
    "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <AppLogo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={navLinkClass(isActive(item.href))}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ModeToggle />
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline" })}
          >
            Sign in
          </Link>
          <Link href="/trips/new" className={buttonVariants()}>
            Create trip
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ModeToggle className="hidden sm:inline-flex" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <XIcon aria-hidden /> : <MenuIcon aria-hidden />}
          </Button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="mobile-menu"
          className="border-t border-border bg-background px-4 py-4 shadow-lg lg:hidden"
        >
          <nav
            className="mx-auto flex max-w-7xl flex-col gap-2"
            aria-label="Mobile"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navLinkClass(isActive(item.href))}
                onClick={closeMenu}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4 sm:hidden">
              <ModeToggle />
            </div>
            <div className="mt-2 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
              <Link
                href="/login"
                className={buttonVariants({ variant: "outline" })}
                onClick={closeMenu}
              >
                Sign in
              </Link>
              <Link
                href="/trips/new"
                className={buttonVariants()}
                onClick={closeMenu}
              >
                Create trip
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
