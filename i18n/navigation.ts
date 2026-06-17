import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware drop-in replacements for next/link and next/navigation.
// Importing from here keeps the active locale prefix on every link/redirect.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
