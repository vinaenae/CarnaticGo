import { Suspense } from "react";
import { PracticeLiveClient } from "@/components/practice/PracticeLiveClient";
import { Skeleton } from "@/components/ui/skeleton";

export default async function PracticeLivePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <PracticeLiveClient sessionId={sessionId} />
    </Suspense>
  );
}
