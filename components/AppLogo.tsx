import { Link } from "@/i18n/navigation";
import { RouteIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
        <RouteIcon className="size-5" aria-hidden />
      </span>
      <span className="text-lg font-semibold tracking-normal">Road Rash</span>
    </Link>
  );
}
