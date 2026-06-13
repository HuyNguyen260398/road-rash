"use client";

import { useTheme } from "next-themes";
import { LaptopIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "light", label: "Use light theme", icon: SunIcon },
  { value: "dark", label: "Use dark theme", icon: MoonIcon },
  { value: "system", label: "Use system theme", icon: LaptopIcon },
] as const;

export default function ModeToggle({ className }: { className?: string }) {
  const { setTheme, theme = "system" } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex rounded-md border border-border bg-background p-1 shadow-sm",
        className,
      )}
      aria-label="Theme mode"
    >
      {MODES.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
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
