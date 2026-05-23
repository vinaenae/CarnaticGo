"use client";

import Link from "next/link";
import {
  KRITI_SAMHITA,
  kritiDatasetCitation,
  kritiPaperCitation,
} from "@/lib/kriti-attribution";
import type { KritiGuessManifest } from "@/lib/kriti-guess-clips";

type Props = {
  manifest?: KritiGuessManifest;
  /** Used when manifest is omitted (e.g. Listen & guess clip count only). */
  clipCount?: number;
};

export function KritiSamhitaAttribution({ manifest, clipCount = 0 }: Props) {
  const clipTotal = manifest?.clips.length ?? clipCount;
  const licenseUrl = manifest?.licenseUrl ?? KRITI_SAMHITA.licenseUrl;
  const licenseName = manifest?.licenseName ?? KRITI_SAMHITA.licenseName;
  const datasetUrl = manifest?.datasetUrl ?? KRITI_SAMHITA.datasetUrl;
  const datasetDoiUrl = manifest?.datasetDoiUrl ?? KRITI_SAMHITA.datasetDoiUrl;
  const datasetCitation = manifest?.datasetCitation ?? kritiDatasetCitation();
  const paperCitation = manifest?.citation ?? kritiPaperCitation();
  const modifications =
    manifest?.modifications ??
    "Mono WAV at 22,050 Hz from published 20 s MP3 snippets for guess-the-rāga. Rāga labels per shruti song lists (A, F#, G, G#).";

  return (
    <aside aria-label="KritiSamhita dataset attribution and license">
      <details className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">
          Data credits & license (KritiSamhita)
        </summary>
        <div className="mt-4 space-y-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            Quiz audio uses the{" "}
            <Link
              href={datasetUrl}
              className="text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {KRITI_SAMHITA.fullTitle}
            </Link>{" "}
            ({clipTotal} excerpt{clipTotal === 1 ? "" : "s"} in this app),
            distributed under{" "}
            <Link
              href={licenseUrl}
              className="text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {licenseName} ({manifest?.license ?? KRITI_SAMHITA.license})
            </Link>
            .
          </p>

          <div>
            <p className="font-medium text-foreground">Dataset record</p>
            <p className="mt-1">{datasetCitation}</p>
            <p className="mt-1">
              DOI:{" "}
              <Link
                href={datasetDoiUrl}
                className="text-primary underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {manifest?.datasetDoi ?? KRITI_SAMHITA.datasetDoi}
              </Link>
            </p>
          </div>

          <div>
            <p className="font-medium text-foreground">Describing article</p>
            <p className="mt-1">{paperCitation}</p>
            <p className="mt-1">
              <Link
                href={manifest?.paperUrl ?? KRITI_SAMHITA.paperUrl}
                className="text-primary underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read on PMC
              </Link>
              {" · "}
              <Link
                href={KRITI_SAMHITA.codeUrl}
                className="text-primary underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Dataset creation code (GitHub)
              </Link>
            </p>
          </div>

          <div>
            <p className="font-medium text-foreground">Modifications</p>
            <p className="mt-1">{modifications}</p>
          </div>

          <p className="text-[11px]">
            CC BY 4.0 requires credit to the authors, a link to the license, and a note of
            changes. Commercial use is allowed with attribution. Do not imply endorsement by the
            dataset creators.
          </p>
        </div>
      </details>
    </aside>
  );
}
