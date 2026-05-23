import Link from "next/link";
import { TheoryQuizShell } from "@/components/theory/TheoryQuizShell";

export default function TheoryPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ← Home
        </Link>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Theory quiz
        </h1>
      </div>

      <TheoryQuizShell />
    </div>
  );
}
