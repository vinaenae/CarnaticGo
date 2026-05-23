import { Suspense } from "react";
import Link from "next/link";
import { SingTalaSessionFinishClient } from "@/components/practice/SingTalaSessionFinishClient";

export default function SingTalaSessionFinishPage() {
  return (
    <div className="space-y-8 pb-8">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        ← Home
      </Link>

      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading session…
          </p>
        }
      >
        <SingTalaSessionFinishClient />
      </Suspense>
    </div>
  );
}
