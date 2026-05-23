/**
 * The 72 melakarta ragas in standard Katapayādi order (1 … 72).
 * Chakras group six consecutive numbers (Indu, Netra, … Adi).
 */

export type MelakartaRaga = {
  /** 1–72 */
  num: number;
  name: string;
  /** 0–11, six ragas per chakra */
  chakra: number;
  /** Chakra name (Sanskrit) */
  chakraName: string;
};

const CHAKRA_NAMES = [
  "Indu",
  "Netra",
  "Agni",
  "Veda",
  "Bana",
  "Rutu",
  "Rishi",
  "Vasu",
  "Brahma",
  "Disi",
  "Rudra",
  "Adi",
] as const;

/** Canonical names (common spellings). */
const NAMES: readonly string[] = [
  "Kanakangi",
  "Ratnangi",
  "Ganamurti",
  "Vanaspati",
  "Manavati",
  "Tanarupi",
  "Senavati",
  "Hanumatodi",
  "Dhenuka",
  "Natakapriya",
  "Kokilapanchami",
  "Rupavati",
  "Gayakapriya",
  "Vakulabharanam",
  "Mayamalavagowla",
  "Chakravakam",
  "Suryakantam",
  "Hatakambhari",
  "Jhankaradhwani",
  "Natabhairavi",
  "Keeravani",
  "Kharaharapriya",
  "Gourimanohari",
  "Varunapriya",
  "Mararanjani",
  "Charukesi",
  "Sarasangi",
  "Harikambhoji",
  "Dheerasankarabharanam",
  "Naganandini",
  "Yagapriya",
  "Ragavardhini",
  "Gangeyabhusani",
  "Vagadheeswari",
  "Sulini",
  "Chalanata",
  "Salagam",
  "Jalarnavam",
  "Jhalavarali",
  "Navaneetam",
  "Pavani",
  "Raghupriya",
  "Gavambhodi",
  "Bhavapriya",
  "Shubhapantuvarali",
  "Shadvidamargini",
  "Suvarnangi",
  "Divyamani",
  "Dhavalambari",
  "Namanarayani",
  "Kamavardani",
  "Ramapriya",
  "Gamanashrama",
  "Vishwambari",
  "Shamalangi",
  "Shanmukhapriya",
  "Simhendramadhyamam",
  "Hemavati",
  "Dharmavati",
  "Neetimati",
  "Kantamani",
  "Rishabhapriya",
  "Latangi",
  "Vachaspati",
  "Mechakalyani",
  "Chitrambari",
  "Sucharitra",
  "Jyotiswarupini",
  "Dhatuvardani",
  "Nasikabhusani",
  "Kosalam",
  "Rasikapriya",
] as const;

export const MELAKARTA_72: readonly MelakartaRaga[] = NAMES.map((name, i) => {
  const num = i + 1;
  const chakra = Math.floor(i / 6);
  return {
    num,
    name,
    chakra,
    chakraName: CHAKRA_NAMES[chakra] ?? "Adi",
  };
});

export function melakartaByNumber(n: number): MelakartaRaga | undefined {
  if (n < 1 || n > 72) return undefined;
  return MELAKARTA_72[n - 1];
}
