"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

const MS_PER_CHAR = 72;

type TypewriterAppNameProps = {
  className?: string;
  /** Letter-by-letter animation after mount (use on login). Off for nav/header. */
  animate?: boolean;
};

export function TypewriterAppName({ className, animate = true }: TypewriterAppNameProps) {
  const [mounted, setMounted] = useState(false);
  const [length, setLength] = useState(0);

  useEffect(() => {
    setMounted(true);
    if (animate) setLength(0);
  }, [animate]);

  useEffect(() => {
    if (!mounted || !animate) return;
    if (length >= APP_NAME.length) return;
    const id = window.setTimeout(() => setLength((n) => n + 1), MS_PER_CHAR);
    return () => clearTimeout(id);
  }, [mounted, animate, length]);

  const typing = mounted && animate;
  const done = length >= APP_NAME.length;
  const visible = typing ? APP_NAME.slice(0, length) : APP_NAME;
  const showCursor = typing && !done;

  return (
    <span className={cn("inline-grid text-left", className)}>
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {APP_NAME}
      </span>
      <span className="col-start-1 row-start-1">
        {visible}
        {showCursor ? (
          <span
            className="ml-0.5 inline-block h-[0.85em] w-[2px] animate-pulse bg-primary align-middle"
            aria-hidden
          />
        ) : null}
      </span>
    </span>
  );
}
