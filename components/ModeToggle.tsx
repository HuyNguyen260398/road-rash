"use client";

import { useEffect, useState } from "react";
import { LaptopIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "light", label: "Use light theme", icon: SunIcon },
  { value: "dark", label: "Use dark theme", icon: MoonIcon },
  { value: "system", label: "Use system theme", icon: LaptopIcon },
] as const;

export default function ModeToggle({ className }: { className?: string }) {
  const { setTheme, theme } = useTheme();

  // The provider can't know the stored/browser theme during SSR, so the server
  // and first client render stay theme-agnostic to avoid a hydration mismatch
  // on aria-pressed/variant. We only reflect the active mode after mount.
  const [mounted, setMounted] = useState(false);
  // The one-shot mount flag is a mount signal, not the cascading-render case
  // this rule guards against.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div
      className={cn(
        "inline-flex rounded-md border border-border bg-background p-1 shadow-sm",
        className,
      )}
      aria-label="Theme mode"
    >
      {MODES.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <Button
            key={value}
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon"
            aria-label={label}
            aria-pressed={active}
            title={label}
            className="size-8"
            onClick={() => setTheme(value)}
          >
            <Icon aria-hidden />
          </Button>
        );
      })}
    </div>
  );
}
