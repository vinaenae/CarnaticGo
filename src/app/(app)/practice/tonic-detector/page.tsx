import Link from "next/link";
import { TonicDetectorClient } from "@/components/practice/TonicDetectorClient";

export default function PracticeTonicDetectorPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ← Home
        </Link>
        <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Practice · Tonic detector
        </p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Tonic detector
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Upload or record a vocal clip (~10–25 seconds), then click Classify shruti. The model
          predicts F♯, G, G♯, or A kattai. You can download the WAV and a JSON report afterward.
        </p>
      </div>

      <TonicDetectorClient />
    </div>
  );
}
