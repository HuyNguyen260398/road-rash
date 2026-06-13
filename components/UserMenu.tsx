"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { HeartIcon, LogOutIcon, PlusIcon, RouteIcon } from "lucide-react";
import { avatarInitial } from "@/lib/avatar";

// Signed-in account control for the navbar. Reads the email client-side to
// render an initial avatar, and opens a dropdown with the saved/authored views
// and sign-out. Renders nothing until a session is confirmed, so signed-out
// visitors keep the plain "Sign in" link in AppHeader.

const MENU_LINKS = [
  { href: "/trips/new", label: "Create trip", icon: PlusIcon },
  { href: "/saved", label: "Liked trips", icon: HeartIcon },
  { href: "/my-trips", label: "My trips", icon: RouteIcon },
] as const;

export default function UserMenu() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetchAuthSession()
      .then((session) => {
        const value = session.tokens?.idToken?.payload.email;
        if (active && typeof value === "string") setEmail(value);
      })
      .catch(() => {
        // Signed out — leave email null so the component renders nothing.
      });
    return () => {
      active = false;
    };
  }, []);

  // Roving focus across the menu items so the `role="menu"` keyboard contract
  // (arrows / Home / End, plus first-item focus on open) is actually honored.
  function focusItem(index: number) {
    const items =
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!items || items.length === 0) return;
    const clamped = (index + items.length) % items.length;
    items[clamped].focus();
  }

  // On open, move focus to the first item per the menu-button pattern.
  useEffect(() => {
    if (open) focusItem(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onOutsidePointer(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      const items =
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!items || items.length === 0) return;
      const current = Array.from(items).indexOf(
        document.activeElement as HTMLElement,
      );
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusItem(current + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          focusItem(current - 1);
          break;
        case "Home":
          e.preventDefault();
          focusItem(0);
          break;
        case "End":
          e.preventDefault();
          focusItem(items.length - 1);
          break;
      }
    }
    document.addEventListener("mousedown", onOutsidePointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutsidePointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    try {
      await signOut();
    } finally {
      // Refresh so SSR pages re-render in the signed-out state.
      router.replace("/");
      router.refresh();
    }
  }

  // Not signed in (yet): render nothing; AppHeader shows the Sign in link.
  if (!email) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {avatarInitial(email)}
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div role="none" className="border-b border-border px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          {MENU_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
          >
            <LogOutIcon className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
