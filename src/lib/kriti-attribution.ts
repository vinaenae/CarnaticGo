/**
 * KritiSamhita — attribution & license (CC BY 4.0).
 * @see https://data.mendeley.com/datasets/nkdm57hvw3/2
 * @see https://doi.org/10.17632/nkdm57hvw3.2
 * @see https://doi.org/10.1016/j.dib.2024.110730
 */

export const KRITI_SAMHITA = {
  name: "KritiSamhita",
  fullTitle:
    "KritiSamhita: South Indian Music Tonic Recognition Dataset (Audio)",
  datasetDoi: "10.17632/nkdm57hvw3.2",
  datasetUrl: "https://data.mendeley.com/datasets/nkdm57hvw3/2",
  datasetDoiUrl: "https://doi.org/10.17632/nkdm57hvw3.2",
  paperDoi: "10.1016/j.dib.2024.110730",
  paperUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11286976/",
  license: "CC BY 4.0",
  licenseName: "Creative Commons Attribution 4.0 International",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  authors: "Konduri S., Pendyala K., Pendyala V.",
  codeUrl: "https://github.com/Sam-Kon/KritiSamhita_SouthICMAudioDataset_Code",
  modifications:
    "Mono WAV at 22,050 Hz derived from the published 20-second MP3 snippets for an educational guess-the-shruti quiz.",
} as const;

/** Mendeley Data record (preferred when citing the files). */
export function kritiDatasetCitation(): string {
  const k = KRITI_SAMHITA;
  return `${k.authors} (2024). ${k.fullTitle} [Data set]. Mendeley Data. ${k.datasetDoiUrl}`;
}

/** Data in Brief article describing the dataset. */
export function kritiPaperCitation(): string {
  const k = KRITI_SAMHITA;
  return `${k.authors} (2024). KritiSamhita: A machine learning dataset of South Indian classical music audio clips with tonic classification. Data in Brief, 55, 110730. https://doi.org/${k.paperDoi}`;
}

/** Default citation string stored in manifest.json. */
export function kritiDefaultCitation(): string {
  return kritiPaperCitation();
}

export function kritiClipCredit(songName: string): string {
  return `“${songName}” — excerpt from ${KRITI_SAMHITA.fullTitle} (${KRITI_SAMHITA.license}).`;
}

export type KritiManifestAttribution = {
  source: string;
  version: number;
  clipSeconds?: number;
  license: string;
  licenseUrl?: string;
  licenseName?: string;
  datasetUrl?: string;
  datasetDoi?: string;
  datasetDoiUrl?: string;
  datasetCitation?: string;
  paperUrl?: string;
  paperDoi?: string;
  citation: string;
  modifications?: string;
  clips: unknown[];
};

export function normalizeKritiManifest<T extends KritiManifestAttribution>(
  raw: T,
): T & Pick<typeof KRITI_SAMHITA, "licenseUrl" | "datasetUrl" | "datasetDoiUrl" | "paperUrl"> {
  return {
    ...raw,
    license: raw.license || KRITI_SAMHITA.license,
    licenseName: raw.licenseName ?? KRITI_SAMHITA.licenseName,
    licenseUrl: raw.licenseUrl ?? KRITI_SAMHITA.licenseUrl,
    datasetUrl: raw.datasetUrl ?? KRITI_SAMHITA.datasetUrl,
    datasetDoi: raw.datasetDoi ?? KRITI_SAMHITA.datasetDoi,
    datasetDoiUrl: raw.datasetDoiUrl ?? KRITI_SAMHITA.datasetDoiUrl,
    datasetCitation: raw.datasetCitation ?? kritiDatasetCitation(),
    paperUrl: raw.paperUrl ?? KRITI_SAMHITA.paperUrl,
    paperDoi: raw.paperDoi ?? KRITI_SAMHITA.paperDoi,
    citation: raw.citation || kritiPaperCitation(),
    modifications: raw.modifications ?? KRITI_SAMHITA.modifications,
  };
}
