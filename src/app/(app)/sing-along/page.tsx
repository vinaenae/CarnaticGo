import Link from "next/link";
import { TeacherSingAlongClient } from "@/components/singalong/TeacherSingAlongClient";

export default function SingAlongPage() {
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
          Match your teacher
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Upload reference audio to detect shruti automatically, then sing in that same shruti.
        </p>
      </div>

      <TeacherSingAlongClient />
    </div>
  );
}
