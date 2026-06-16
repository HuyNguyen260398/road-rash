import { MapIcon, LinkIcon, Share2Icon, type LucideIcon } from "lucide-react";

// The My Maps workflow, stated up front. Google My Maps has no public API, so
// the user builds the map by hand and pastes the share link — these three steps
// set that expectation before someone tries to create a trip.
const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MapIcon,
    title: "Build your route in Google My Maps",
    body: "Drop pins, draw your route, and add stops in the My Maps editor you already know.",
  },
  {
    icon: LinkIcon,
    title: "Paste the share link",
    body: "Copy your My Maps share link into the trip form, then add the details: vehicle, duration, and where it goes.",
  },
  {
    icon: Share2Icon,
    title: "Share & discover",
    body: "Publish your trip for the community and explore map-backed routes other riders have shared.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-muted">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
          <p className="mt-2 text-muted-foreground">
            Road Rash is built around the Google My Maps you already make — three
            steps from idea to a shared trip.
          </p>
        </header>
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="relative rounded-lg border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </div>
              <p className="mb-1 text-sm font-medium text-muted-foreground">
                Step {i + 1}
              </p>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
