"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Keep SSR and first client paint identical; apply saved theme after mount.
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
      title={isDark ? "Day mode" : "Night mode"}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center rounded-full border border-border/80 bg-muted/60 p-0.5 shadow-sm transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-wait disabled:opacity-70",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-background shadow-sm transition-transform duration-200",
          isDark ? "translate-x-full" : "translate-x-0",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "relative z-10 flex size-7 items-center justify-center rounded-full transition-colors",
          !isDark ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Sun className="size-3.5" aria-hidden />
        <span className="sr-only">Day</span>
      </span>
      <span
        className={cn(
          "relative z-10 flex size-7 items-center justify-center rounded-full transition-colors",
          isDark ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Moon className="size-3.5" aria-hidden />
        <span className="sr-only">Night</span>
      </span>
    </button>
  );
}
