import Link from "next/link";
import { NoticesDocument } from "@/components/legal/NoticesDocument";
import { loadNoticesMarkdown } from "@/lib/load-notices";

export const metadata = {
  title: "About & legal — ragify.ai",
  description: "Attribution, licenses, and third-party data notices for ragify.ai",
};

export default async function AboutLegalPage() {
  const notices = await loadNoticesMarkdown();

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ← Home
        </Link>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-foreground">
          About & legal
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Third-party datasets, required citations, and license terms used in ragify.ai quizzes and
          audio features. This page mirrors{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">public/NOTICES.md</code> in the
          repository.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm">
        <NoticesDocument markdown={notices} />
      </section>

      <section className="rounded-2xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        <h2 className="font-heading text-lg font-semibold text-foreground">Tonic detector model</h2>
        <p className="mt-2">
          The shruti (tonic) classifier is trained on the{" "}
          <a
            href="https://data.mendeley.com/datasets/nkdm57hvw3/2"
            className="text-primary underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            KritiSamhita
          </a>{" "}
          dataset (F♯, G, G♯, A). Weights live in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            services/tonic-detector/checkpoints/
          </code>
          . Retrain with{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run train:tonic</code>.
        </p>
      </section>
    </div>
  );
}
