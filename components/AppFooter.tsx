import { Link } from "@/i18n/navigation";
import AppLogo from "@/components/AppLogo";
import { Separator } from "@/components/ui/separator";

const FOOTER_LINKS = [
  { href: "/", label: "Discover" },
  { href: "/saved", label: "Saved" },
  { href: "/my-trips", label: "My trips" },
  { href: "/trips/new", label: "Create trip" },
] as const;

export default function AppFooter() {
  return (
    <footer className="bg-background">
      <Separator />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <AppLogo />
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"
            aria-label="Footer"
          >
            {FOOTER_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Road Rash routes and Google My Maps links are user supplied. Verify
          road conditions, access rules, and safety details before you travel.
        </p>
      </div>
    </footer>
  );
}
