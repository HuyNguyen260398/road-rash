"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { fetchAuthSession, getCurrentUser, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { HeartIcon, LogOutIcon, PlusIcon, RouteIcon } from "lucide-react";
import { avatarInitial } from "@/lib/avatar";

// Signed-in account control for the navbar. Reads the email client-side to
// render an initial avatar, and opens a dropdown with the saved/authored views
// and sign-out. Renders nothing until a session is confirmed, so signed-out
// visitors keep the plain "Sign in" link in AppHeader.
//
// Because the Google OAuth redirect lands on "/" (not /login), this component
// mounts *while* Amplify is still completing the code->token exchange, so the
// first fetch can resolve before the session exists. We therefore subscribe to
// the auth Hub and re-read the session on sign-in/redirect completion, mirroring
// the login page — otherwise the avatar never appears until a manual reload.

const MENU_LINKS = [
  { href: "/trips/new", label: "Create trip", icon: PlusIcon },
  { href: "/saved", label: "Liked trips", icon: HeartIcon },
  { href: "/my-trips", label: "My trips", icon: RouteIcon },
] as const;

export default function UserMenu() {
  const router = useRouter();
  // The account label: the email claim when present, otherwise the username, so
  // the avatar still renders when an ID token lacks `email` (the login page has
  // the same fallback). Null means "no confirmed session" → render nothing.
  const [label, setLabel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const refreshSession = useCallback(async () => {
    try {
      const current = await getCurrentUser();
      const session = await fetchAuthSession();
      const email = session.tokens?.idToken?.payload.email;
      return typeof email === "string" ? email : current.username;
    } catch {
      // No authenticated user (signed out, or token exchange not done yet).
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const apply = () =>
      void refreshSession().then((value) => {
        if (active) setLabel(value);
      });

    // Initial read on mount.
    apply();

    // Re-read once the OAuth redirect / sign-in completes, and clear on sign-out.
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signInWithRedirect":
          apply();
          break;
        case "signedOut":
          if (active) setLabel(null);
          break;
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [refreshSession]);

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
  if (!label) return null;

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
        {avatarInitial(label)}
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div role="none" className="border-b border-border px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">{label}</p>
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
