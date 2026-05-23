"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  parseScaleQuizMode,
  SCALE_QUIZ_MODE_OPTIONS,
  type ScaleQuizMode,
} from "@/components/melakarta/ScaleQuizClient";
import { cn } from "@/lib/utils";

const RAGA_QUIZZES = [
  { href: "/melakarta/listen-quiz", label: "Listen & guess" },
] as const;

const SHRUTI_QUIZZES = [
  { href: "/practice/tanpura-match", label: "Guess the shruti" },
] as const;

export function isQuizzesPath(path: string) {
  return (
    path === "/theory" ||
    path.startsWith("/theory/") ||
    path.startsWith("/practice/tanpura-match") ||
    path.startsWith("/melakarta/listen-quiz") ||
    path.startsWith("/melakarta/scale-quiz")
  );
}

function isScaleQuizModeActive(pathname: string, modeParam: string | null, mode: ScaleQuizMode) {
  if (!pathname.startsWith("/melakarta/scale-quiz")) return false;
  return parseScaleQuizMode(modeParam) === mode;
}

type QuizzesDropdownProps = {
  variant?: "nav" | "dashboard";
};

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

function ScaleQuizSubmenu({
  pathname,
  modeParam,
  onNavigate,
}: {
  pathname: string;
  modeParam: string | null;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLLIElement>(null);
  const scaleQuizActive = pathname.startsWith("/melakarta/scale-quiz");

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <li ref={wrapRef} className="relative">
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-primary/8",
          (scaleQuizActive || open) && "bg-primary/12 font-medium text-foreground",
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <span>Scale quiz</span>
        <span className="text-[10px] opacity-70" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Scale quiz"
          className="absolute left-full top-0 z-[60] ml-1.5 w-52 rounded-xl border border-border bg-card p-2 shadow-lg ring-1 ring-foreground/5"
        >
          <ul className="space-y-0.5">
            {SCALE_QUIZ_MODE_OPTIONS.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  role="menuitem"
                  className={menuItemClass(
                    isScaleQuizModeActive(pathname, modeParam, item.id),
                  )}
                  onClick={onNavigate}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export function QuizzesDropdown({ variant = "nav" }: QuizzesDropdownProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const quizzesActive = isQuizzesPath(pathname);

  const closeAll = () => setOpen(false);

  useEffect(() => {
    closeAll();
  }, [pathname, modeParam]);

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

  const triggerClass =
    variant === "dashboard"
      ? cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "transition-transform hover:-translate-y-0.5",
        )
      : navTriggerClass(quizzesActive);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        Quizzes
        <span className="text-[10px] opacity-70" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 rounded-xl border border-border bg-card p-2 shadow-lg ring-1 ring-foreground/5"
        >
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/theory"
                role="menuitem"
                className={menuItemClass(pathname === "/theory")}
                onClick={closeAll}
              >
                Theory quiz
              </Link>
            </li>
            {SHRUTI_QUIZZES.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  role="menuitem"
                  className={menuItemClass(pathname.startsWith(item.href))}
                  onClick={closeAll}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {RAGA_QUIZZES.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  role="menuitem"
                  className={menuItemClass(pathname.startsWith(item.href))}
                  onClick={closeAll}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <ScaleQuizSubmenu
              pathname={pathname}
              modeParam={modeParam}
              onNavigate={closeAll}
            />
          </ul>
        </div>
      ) : null}
    </div>
  );
}
