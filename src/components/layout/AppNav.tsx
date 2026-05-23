"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ExtrasDropdown } from "@/components/layout/ExtrasDropdown";
import { QuizzesDropdown } from "@/components/quizzes/QuizzesDropdown";
import { isExtrasPath } from "@/lib/extras-nav";
import { isPracticePath, START_PRACTICE_SESSION } from "@/lib/practice-modes";

function navLinkClass(active: boolean) {
  return cn(
    "rounded-full px-3 py-1.5 font-medium transition-colors",
    active
      ? "bg-primary/12 text-foreground"
      : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
  );
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link href="/dashboard" className={navLinkClass(pathname === "/dashboard")}>
        Home
      </Link>
      <Link
        href={START_PRACTICE_SESSION.href}
        className={navLinkClass(isPracticePath(pathname))}
      >
        Practice
      </Link>
      <Suspense
        fallback={
          <span className={navLinkClass(false)} aria-hidden>
            Quizzes ▾
          </span>
        }
      >
        <QuizzesDropdown variant="nav" />
      </Suspense>
      <Link href="/melakarta" className={navLinkClass(pathname === "/melakarta")}>
        Melakartas
      </Link>
      <Link href="/leaderboard" className={navLinkClass(pathname.startsWith("/leaderboard"))}>
        Leaderboard
      </Link>
      <Link href="/shop" className={navLinkClass(pathname.startsWith("/shop"))}>
        Shop
      </Link>
      <Suspense
        fallback={
          <span className={navLinkClass(isExtrasPath(pathname))} aria-hidden>
            Extras ▾
          </span>
        }
      >
        <ExtrasDropdown />
      </Suspense>
    </nav>
  );
}
