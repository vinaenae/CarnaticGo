import { Suspense } from "react";
import { ScaleQuizPageHeader } from "@/components/melakarta/ScaleQuizPageHeader";
import { ScaleQuizShell } from "@/components/melakarta/ScaleQuizShell";

export default function MelakartaScaleQuizPage() {
  return (
    <div className="space-y-8">
      <Suspense
        fallback={
          <div className="h-16 animate-pulse rounded-lg bg-primary/10" aria-hidden />
        }
      >
        <ScaleQuizPageHeader />
      </Suspense>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading quiz…</p>}>
        <ScaleQuizShell />
      </Suspense>
    </div>
  );
}
