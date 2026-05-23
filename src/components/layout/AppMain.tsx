"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMelakartaWheel = pathname === "/melakarta";

  return (
    <main
      className={cn(
        "mx-auto w-full",
        isMelakartaWheel
          ? "max-w-none flex min-h-0 flex-1 flex-col p-0"
          : "max-w-5xl px-4 py-10",
      )}
    >
      {children}
    </main>
  );
}
