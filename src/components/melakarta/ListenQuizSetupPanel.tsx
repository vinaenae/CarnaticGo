"use client";

import Link from "next/link";
import { KRITI_LISTEN_EXPORT_CMD, KRITI_SAMHITA } from "@/lib/raga-guess-clips";

export function ListenQuizSetupPanel() {
  return (
    <div className="mt-4 space-y-4 rounded-xl border border-amber-500/35 bg-amber-500/5 p-4 text-sm">
      <p className="font-medium text-foreground">Set up KritiSamhita clips</p>
      <p className="leading-relaxed text-muted-foreground">
        Listen &amp; guess uses 20-second vocal snippets from the{" "}
        <Link
          href={KRITI_SAMHITA.datasetUrl}
          className="text-primary underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          KritiSamhita
        </Link>{" "}
        dataset ({KRITI_SAMHITA.license}). Rāga labels come from shruti song lists in{" "}
        <code className="text-[11px]">data/kriti-samhita/*-shruti-raga-map.json</code>.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-xs text-muted-foreground">
        <li>
          Download <code className="text-[11px]">Carnatic_Dataset_Snippets.zip</code> from{" "}
          <Link
            href={KRITI_SAMHITA.datasetUrl}
            className="text-primary underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Mendeley Data
          </Link>{" "}
          into <code className="text-[11px]">data/kriti-samhita/</code> (or copy from Downloads).
        </li>
        <li>Run the export script from the project root (replaces old sam-carnatic / Sanidha clips).</li>
      </ol>
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-foreground">Export listen clips</p>
        <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 font-mono text-[10px] leading-relaxed text-foreground">
          {KRITI_LISTEN_EXPORT_CMD} --tonic all --fresh-all
        </pre>
        <p className="text-[11px] text-muted-foreground">
          Add one shruti only: <code className="text-[10px]">{KRITI_LISTEN_EXPORT_CMD} --tonic F#</code>
        </p>
      </div>
    </div>
  );
}
