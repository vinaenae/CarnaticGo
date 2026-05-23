"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  activeExtrasNavItem,
  EXTRAS_NAV_ITEMS,
  isExtrasPath,
} from "@/lib/extras-nav";
import { cn } from "@/lib/utils";

function navTriggerClass(active: boolean) {
  return cn(
    "rounded-full px-3 py-1.5 font-medium transition-colors inline-flex items-center gap-1",
    active
      ? "bg-primary/12 text-foreground"
      : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
  );
}

function menuItemClass(active: boolean) {
  return cn(
    "block w-full rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-primary/8",
    active && "bg-primary/12 font-medium text-foreground",
  );
}

export function ExtrasDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const extrasActive = isExtrasPath(pathname);
  const currentItem = activeExtrasNavItem(pathname);

  const closeAll = () => setOpen(false);

  useEffect(() => {
    closeAll();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeAll();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={navTriggerClass(extrasActive)}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        Extras
        <span className="text-[10px] opacity-70" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-56 rounded-xl border border-border bg-card p-2 shadow-lg ring-1 ring-foreground/5 sm:left-auto sm:right-0"
        >
          <ul className="space-y-0.5">
            {EXTRAS_NAV_ITEMS.map((item) => (
              <li key={item.id}>
                {"comingSoon" in item && item.comingSoon ? (
                  <span
                    role="menuitem"
                    aria-disabled="true"
                    className={cn(
                      menuItemClass(false),
                      "flex cursor-default items-center justify-between gap-2 text-muted-foreground",
                    )}
                  >
                    {item.label}
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                      Coming soon
                    </span>
                  </span>
                ) : (
                  <a
                    href={"href" in item ? item.href : "#"}
                    role="menuitem"
                    className={menuItemClass(extrasActive && currentItem === item.id)}
                    onClick={closeAll}
                  >
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
