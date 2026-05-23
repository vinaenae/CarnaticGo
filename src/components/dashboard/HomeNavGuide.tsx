"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ArrowLine = { x1: number; y1: number; x2: number; y2: number };

/** Draw only this fraction of the distance toward the nav (keeps arrow readable). */
const ARROW_LENGTH_RATIO = 0.72;

function shortenToward(
  x1: number,
  y1: number,
  targetX: number,
  targetY: number,
): { x2: number; y2: number } {
  return {
    x2: x1 + (targetX - x1) * ARROW_LENGTH_RATIO,
    y2: y1 + (targetY - y1) * ARROW_LENGTH_RATIO,
  };
}

export function HomeNavGuide() {
  const anchorRef = useRef<HTMLParagraphElement>(null);
  const [line, setLine] = useState<ArrowLine | null>(null);

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    const nav = document.querySelector("header nav");
    if (!anchor || !nav) {
      setLine(null);
      return;
    }

    const origin = anchor.getBoundingClientRect();
    const x1 = origin.left + origin.width * 0.35;
    const y1 = origin.top;

    const navRect = nav.getBoundingClientRect();
    const targetX = navRect.left + navRect.width / 2;
    const targetY = navRect.bottom + 8;
    const end = shortenToward(x1, y1, targetX, targetY);

    setLine({ x1, y1, x2: end.x2, y2: end.y2 });
  }, []);

  useEffect(() => {
    measure();
    const t = window.setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [measure]);

  return (
    <>
      <p className="sr-only">
        Use the tabs at the top of the page to get started.
      </p>

      <svg
        className="pointer-events-none fixed inset-0 z-[5] h-full w-full"
        aria-hidden
      >
        <defs>
          <marker
            id="home-nav-arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="5"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 Z" className="fill-primary" />
          </marker>
        </defs>
        {line ? (
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-primary"
            markerEnd="url(#home-nav-arrowhead)"
          />
        ) : null}
      </svg>

      <div className="mt-8 flex w-full justify-end sm:mt-10">
        <p
          ref={anchorRef}
          className="rounded bg-primary/12 px-3 py-1 text-[11px] font-medium tracking-wide text-foreground sm:text-xs"
          aria-hidden
        >
          Use the tabs above to start
        </p>
      </div>
    </>
  );
}
