"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "@/components/practice/MusicTermTip.module.css";
import { cn } from "@/lib/utils";

type MusicTermTipProps = {
  term: string;
  definition: string;
  className?: string;
};

/** Inline term with definition on hover, focus, or tap/click. */
export function MusicTermTip({ term, definition, className }: MusicTermTipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className={cn(styles.wrap, open && styles.wrapOpen, className)}>
      <button
        type="button"
        className={styles.term}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {term}
      </button>
      <span id={tipId} role="tooltip" className={styles.tip}>
        {definition}
      </span>
    </span>
  );
}
