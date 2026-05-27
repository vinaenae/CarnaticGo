/**
 * Per-melakarta name meaning (Means) and swara family (Group).
 * Means: etymology of the raga name — not the parent chakra name.
 * Group: Ri–Ga, Ma, and Dha–Ni variants for this mela (Govindacharya scheme).
 *
 * @see https://en.wikipedia.org/wiki/Melakarta
 * @see http://www.dpattammal.com/ragapravaham_more.htm
 * @see https://sites.google.com/site/kalpsangeethasabha/ragas/72-melakarta-ragas
 * @see https://www.indian-heritage.org/music/Melakartha%20Raga%20Booklet%20-%20new.pdf
 */

import { melakartaSwaraScale } from "@/lib/melakarta-swaras";

/** Ri–Ga pair repeats every 6 melas; Dha–Ni pair steps through each mela in a chakra. */
const RG_GROUP_LABELS = [
  "Shuddha Ri, Shuddha Ga",
  "Shuddha Ri, Sadharana Ga",
  "Shuddha Ri, Antara Ga",
  "Chatusruti Ri, Sadharana Ga",
  "Chatusruti Ri, Antara Ga",
  "Shatsruti Ri, Antara Ga",
] as const;

const DN_GROUP_LABELS = [
  "Shuddha Dha, Shuddha Ni",
  "Shuddha Dha, Kaisiki Ni",
  "Shuddha Dha, Kakali Ni",
  "Chatusruti Dha, Kaisiki Ni",
  "Chatusruti Dha, Kakali Ni",
  "Shatsruti Dha, Kakali Ni",
] as const;

/** Name meaning for melakarta 1–72 (Govindacharya names). */
export const MELAKARTA_MEANS: readonly string[] = [
  "Golden-bodied", // 1 Kanakangi
  "Gem-bodied", // 2 Ratnangi
  "Embodiment of music", // 3 Ganamurti
  "Lord of the forest", // 4 Vanaspati
  "Belonging to Manu", // 5 Manavati
  "Form of tone", // 6 Tanarupi
  "Rich in armies", // 7 Senavati
  "Hanumān's Todi", // 8 Hanumatodi
  "She-ass (mythic tone)", // 9 Dhenuka
  "Beloved of drama", // 10 Natakapriya
  "Beloved of the koel", // 11 Kokilapanchami
  "Beautiful form", // 12 Rupavati
  "Beloved of singers", // 13 Gayakapriya
  "Adorned with vakula flowers", // 14 Vakulabharanam
  "Garland of Māyā-Mālavagauḷa", // 15 Mayamalavagowla
  "Like the chakravāka bird", // 16 Chakravakam
  "Sun-rayed", // 17 Suryakantam
  "Golden garment", // 18 Hatakambhari
  "Sound of the harp", // 19 Jhankaradhwani
  "Beloved of Nata and Bhairavi", // 20 Natabhairavi
  "Parrot-voiced", // 21 Keeravani
  "Stealer of hearts", // 22 Kharaharapriya
  "Charming as a cowherd", // 23 Gourimanohari
  "Beloved of Varuna", // 24 Varunapriya
  "Delighting the mind", // 25 Mararanjani
  "Beautiful hair", // 26 Charukesi
  "Essence of the sāras bird", // 27 Sarasangi
  "Beloved of Hari and Kāmbhōji", // 28 Harikambhoji
  "Bold Śaṅkarābharaṇam", // 29 Dheerasankarabharanam
  "Joy of the serpent", // 30 Naganandini
  "Beloved of sacrifice", // 31 Yagapriya
  "That which grows rāga", // 32 Ragavardhini
  "Adorned by the Ganges", // 33 Gangeyabhusani
  "Goddess of speech", // 34 Vagadheeswari
  "Spear-bearing (Śūlinī)", // 35 Sulini
  "Moving melody", // 36 Chalanata
  "Moving together", // 37 Salagam
  "Ocean of water", // 38 Jalarnavam
  "Crest of waves", // 39 Jhalavarali
  "Butter-like", // 40 Navaneetam
  "Sacred to Pāvani", // 41 Pavani
  "Beloved of Raghu", // 42 Raghupriya
  "Ocean of cows", // 43 Gavambhodi
  "Beloved of Bhava (Śiva)", // 44 Bhavapriya
  "Auspicious Pantuvarāli", // 45 Shubhapantuvarali
  "Sixfold path", // 46 Shadvidamargini
  "Golden-bodied", // 47 Suvarnangi
  "Jewel of the gods", // 48 Divyamani
  "White garment", // 49 Dhavalambari
  "Named for Nārāyaṇa", // 50 Namanarayani
  "That increases desire", // 51 Kamavardani
  "Beloved of Rāma", // 52 Ramapriya
  "Abode of song", // 53 Gamanashrama
  "All-pervading", // 54 Vishwambari
  "Dark-bodied", // 55 Shamalangi
  "Beloved of Shanmukha", // 56 Shanmukhapriya
  "Hen's madhyama", // 57 Simhendramadhyamam
  "Golden (Hemavati)", // 58 Hemavati
  "Lawful, righteous", // 59 Dharmavati
  "Moral-minded", // 60 Neetimati
  "Jewel of desire", // 61 Kantamani
  "Beloved of Riṣabha", // 62 Rishabhapriya
  "Creeper-like", // 63 Latangi
  "Lord of speech", // 64 Vachaspati
  "Fish-eyed Kalyāṇi", // 65 Mechakalyani
  "Variegated", // 66 Chitrambari
  "Good conduct", // 67 Sucharitra
  "Light-formed", // 68 Jyotiswarupini
  "Rich in elements", // 69 Dhatuvardani
  "Ornament of Nāsikā", // 70 Nasikabhusani
  "Of Kosala", // 71 Kosalam
  "Beloved of connoisseurs", // 72 Rasikapriya
];

export function melakartaMeans(num: number): string {
  if (num < 1 || num > 72) return "—";
  return MELAKARTA_MEANS[num - 1] ?? "—";
}

/** Swara family unique to this melakarta (not the whole chakra). */
export function melakartaGroup(num: number): string {
  if (num < 1 || num > 72) return "—";
  const chakraSlot = Math.floor((num - 1) / 6) % 6;
  const dnSlot = (num - 1) % 6;
  const ma =
    num <= 36 ? "Shuddha Madhyama (M₁)" : "Prati Madhyama (M₂)";
  return `${RG_GROUP_LABELS[chakraSlot]}; ${ma}; ${DN_GROUP_LABELS[dnSlot]}`;
}

/** Short scale line for optional display. */
export function melakartaGroupShort(num: number): string {
  const scale = melakartaSwaraScale(num);
  return scale.arohanam.replace(/Ṡ/g, "S'");
}
