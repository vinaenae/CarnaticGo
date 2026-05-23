import { Suspense } from "react";
import { PracticeStartRedirect } from "@/components/practice/PracticeStartRedirect";
import { Skeleton } from "@/components/ui/skeleton";

export default function PracticeNewPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <PracticeStartRedirect />
    </Suspense>
  );
}
