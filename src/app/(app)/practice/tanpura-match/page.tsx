import Link from "next/link";
import { TanpuraMatchQuizClient } from "@/components/melakarta/TanpuraMatchQuizClient";

export default function PracticeTanpuraMatchPage() {
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
          Quizzes · Shruti
        </p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Guess the shruti
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Two attempts per round.
        </p>
      </div>

      <TanpuraMatchQuizClient />
    </div>
  );
}
