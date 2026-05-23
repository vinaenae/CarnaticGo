/**
 * Mood (rasa) and famous compositions for melakarta ragas.
 */

import { CHAKRA_DEFAULT_MOOD } from "@/lib/melakarta-chakras";
import type { MelakartaRaga } from "@/lib/melakarta72";

export type MelakartaComposition = {
  title: string;
  composer?: string;
};

export type MelakartaRagaDetail = {
  mood: string;
  compositions: MelakartaComposition[];
};

/** Per-melakarta overrides (mood + compositions). Others use chakra defaults. */
const RAGA_OVERRIDES: Partial<Record<number, MelakartaRagaDetail>> = {
  8: {
    mood: "Karuṇa, devotion; like Todi",
    compositions: [
      { title: "Endaro Mahanubhavulu", composer: "Tyagaraja" },
      { title: "Kamalamba Navavarna", composer: "Dikshitar" },
    ],
  },
  15: {
    mood: "Śānta, peaceful; morning",
    compositions: [
      { title: "Sarali varisai", composer: "Traditional" },
      { title: "Tulasīdalamulacē", composer: "Tyagaraja" },
      { title: "Guruguho Jayati", composer: "Dikshitar" },
    ],
  },
  20: {
    mood: "Plaintive, serious tone",
    compositions: [
      { title: "Śri Kamalāmbikayā", composer: "Dikshitar" },
      { title: "Chetulāra Śringāramu", composer: "Tyagaraja" },
    ],
  },
  21: {
    mood: "Dramatic, emotional depth",
    compositions: [
      { title: "Kaligiyunte", composer: "Tyagaraja" },
      { title: "Ennai Kakkum", composer: "Papanasam Sivan" },
    ],
  },
  22: {
    mood: "Karuṇa, compassion; Kafi",
    compositions: [
      { title: "Chakkani Rājamārgamu", composer: "Tyagaraja" },
      { title: "Pakkala Nilabaḍi", composer: "Tyagaraja" },
      { title: "Vevela Velpulalo", composer: "N. C. Murthy" },
    ],
  },
  26: {
    mood: "Romantic, lyrical śṛṅgāra",
    compositions: [{ title: "Ādamodi Galadā", composer: "Tyagaraja" }],
  },
  28: {
    mood: "Bright, uplifting; major-like",
    compositions: [
      { title: "Vātāpi Ganapatim", composer: "Dikshitar" },
      { title: "Nādōpāsana", composer: "Tyagaraja" },
    ],
  },
  29: {
    mood: "Joyful, majestic; anthem",
    compositions: [
      { title: "Bhavayami Raghuramam", composer: "Swati Thirunal" },
      { title: "Jagadānandakāraka", composer: "Tyagaraja" },
    ],
  },
  36: {
    mood: "Intense, vivādi; advanced",
    compositions: [{ title: "Kanda Ganamudam", composer: "Koteeswara Iyer" }],
  },
  39: {
    mood: "Austere, vivādi; grave",
    compositions: [{ title: "Kanda Ganamudam", composer: "Koteeswara Iyer" }],
  },
  45: {
    mood: "Heavy devotion; gravity",
    compositions: [
      { title: "Ennēramum", composer: "Tyagaraja" },
      { title: "Kanda Ganamudam", composer: "Koteeswara Iyer" },
    ],
  },
  51: {
    mood: "Intense pathos; Pantuvarāli",
    compositions: [
      { title: "Appa Rāmabhakti", composer: "Tyagaraja" },
      { title: "Kanda Ganamudam", composer: "Koteeswara Iyer" },
    ],
  },
  53: {
    mood: "Serious, expansive alapana",
    compositions: [{ title: "Kanda Ganamudam", composer: "Koteeswara Iyer" }],
  },
  57: {
    mood: "Grand, majestic; vīra",
    compositions: [
      { title: "Śrī Rājarājēśvarī", composer: "Dikshitar" },
      { title: "Kanda Ganamudam", composer: "Koteeswara Iyer" },
    ],
  },
  58: {
    mood: "Lyrical, romantic; Hemavati",
    compositions: [{ title: "Kanda Ganamudam", composer: "Koteeswara Iyer" }],
  },
  65: {
    mood: "Auspicious, bright; Kalyani",
    compositions: [
      { title: "Nidhi Cāla Sukhama", composer: "Tyagaraja" },
      { title: "Kāmākṣhi Mām Pāhi", composer: "Dikshitar" },
    ],
  },
  66: {
    mood: "Bright, scholarly; vivādi",
    compositions: [{ title: "Kanda Ganamudam", composer: "Koteeswara Iyer" }],
  },
  68: {
    mood: "Devotional, uplifting",
    compositions: [{ title: "Kanda Ganamudam", composer: "Koteeswara Iyer" }],
  },
  72: {
    mood: "Last scale; solemn, rich",
    compositions: [
      { title: "Kanda Ganamudam", composer: "Koteeswara Iyer" },
      { title: "72-mela ragamalika", composer: "Maha Vaidyanatha Sivan" },
    ],
  },
};

function defaultDetail(raga: MelakartaRaga): MelakartaRagaDetail {
  return {
    mood: CHAKRA_DEFAULT_MOOD[raga.chakra] ?? "Depends on song and style",
    compositions: [
      { title: "Kanda Ganamudam", composer: "Koteeswara Iyer" },
      { title: "72-mela ragamalika", composer: "Maha Vaidyanatha Sivan" },
    ],
  };
}

export function melakartaRagaDetail(raga: MelakartaRaga): MelakartaRagaDetail {
  return RAGA_OVERRIDES[raga.num] ?? defaultDetail(raga);
}
