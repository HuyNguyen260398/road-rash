import {
  MapIcon,
  HeartIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MapIcon,
    title: "Map-backed plans",
    body: "Every trip embeds a real Google My Maps route — no vague itineraries, just the actual path on the map.",
  },
  {
    icon: HeartIcon,
    title: "Save your favorites",
    body: "Heart any route to build your own shortlist, then come back to it from your saved trips.",
  },
  {
    icon: SparklesIcon,
    title: "AI trip discovery",
    body: "Describe the trip you want and let AI rank the community's routes down to the best matches.",
  },
];

export default function FeatureHighlights() {
  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Everything you need to plan the next ride
          </h2>
        </header>
        <div className="grid gap-6 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                <Icon className="size-5" aria-hidden />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
