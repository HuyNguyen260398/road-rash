import type { ReactNode } from "react";
import { CompassIcon } from "lucide-react";

// Reusable empty / no-result state (TASK-037). Server-component-safe (no client
// hooks) so it works in SSR pages and inside TripGrid alike.
//
// Wired into the surfaces that exist today: Home discovery, search/filter
// "no matches" (via TripGrid), My Trips, and the load-error fallbacks.
// TODO(M4): wire into the Saved/favorites page once that surface ships — the
// component is ready, the page isn't built yet.

export default function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-16 text-center shadow-sm">
      <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon ?? <CompassIcon className="size-6" aria-hidden />}
      </div>
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
