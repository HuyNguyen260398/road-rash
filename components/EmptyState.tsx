import type { ReactNode } from "react";

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
  icon = "🧭",
  action,
}: {
  title: string;
  description?: string;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span aria-hidden className="text-4xl opacity-40">
        {icon}
      </span>
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm opacity-60">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
