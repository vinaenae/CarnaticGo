import Link from "next/link";
import { RagaListenQuizClient } from "@/components/melakarta/RagaListenQuizClient";

export default function MelakartaListenQuizPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/melakarta"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ← Melakarta
        </Link>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Listen & guess the rāga
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Type the rāga name — two attempts per round.
        </p>
      </div>

      <RagaListenQuizClient />
    </div>
  );
}