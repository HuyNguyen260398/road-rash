"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { signOut } from "aws-amplify/auth";
import { LogOutIcon, MenuIcon, XIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { DURATION, EASE, REDUCED_MOTION_QUERY } from "@/lib/motion";
import AppLogo from "@/components/AppLogo";
import UserMenu from "@/components/UserMenu";
import ModeToggle from "@/components/ModeToggle";
import { useFavorites } from "@/components/FavoritesProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Destinations that live in the avatar dropdown on desktop but stay in the
// mobile menu so every view is reachable on small screens. Shown to all users
// on mobile (the logo links to Discover); guests who tap them are redirected to
// /login by the target pages' own auth guards.
const ACCOUNT_LINKS = [
  { href: "/saved", key: "savedTrips" },
  { href: "/my-trips", key: "myTrips" },
] as const;

function navLinkClass(active: boolean) {
  return cn(
    "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
  );
}

export default function AppHeader() {
  const t = useTranslations("header");
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  // Single source of auth state for the shell (FavoritesProvider wraps the app
  // and resolves the session once). `ready` gates the auth controls so a
  // signed-in user never flashes the "Sign in" link before the session loads.
  const { ready, signedIn } = useFavorites();

  const headerRef = useRef<HTMLElement>(null);
  // Read the latest menu state inside the ScrollTrigger callback without
  // re-creating the trigger on every toggle.
  const menuOpenRef = useRef(menuOpen);
  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  // Hide the sticky header on scroll-down, reveal on scroll-up. Stays put at the
  // top, while the mobile menu is open, and for reduced-motion users.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        const el = headerRef.current!;
        const show = () =>
          gsap.to(el, { yPercent: 0, duration: DURATION.fast, ease: EASE.out });
        const hide = () =>
          gsap.to(el, {
            yPercent: -100,
            duration: DURATION.fast,
            ease: EASE.inOut,
          });
        ScrollTrigger.create({
          start: "top top-=80",
          end: "max",
          onUpdate: (self) => {
            if (self.direction === 1 && !menuOpenRef.current) hide();
            else show();
          },
        });
      });
    },
    { scope: headerRef },
  );

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  async function handleSignOut() {
    setMenuOpen(false);
    try {
      await signOut();
    } finally {
      // Refresh so SSR pages re-render in the signed-out state.
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <AppLogo />

        <div className="hidden items-center gap-3 lg:flex">
          <ModeToggle />
          {ready && !signedIn ? (
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline" })}
            >
              {t("signIn")}
            </Link>
          ) : null}
          <UserMenu />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ModeToggle className="hidden sm:inline-flex" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
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
            {ACCOUNT_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navLinkClass(isActive(item.href))}
                onClick={closeMenu}
              >
                {t(item.key)}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4 sm:hidden">
              <ModeToggle />
            </div>
            <div className="mt-2 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
              {ready && !signedIn ? (
                <Link
                  href="/login"
                  className={buttonVariants({ variant: "outline" })}
                  onClick={closeMenu}
                >
                  {t("signIn")}
                </Link>
              ) : null}
              {signedIn ? (
                <Link
                  href="/trips/new"
                  className={buttonVariants()}
                  onClick={closeMenu}
                >
                  {t("createTrip")}
                </Link>
              ) : null}
              {signedIn ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-1.5"
                  onClick={handleSignOut}
                >
                  <LogOutIcon aria-hidden className="size-4" />
                  {t("signOut")}
                </Button>
              ) : null}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
