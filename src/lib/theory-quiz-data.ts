/**
 * Carnatic theory quiz — topics drawn from introductory overview material
 * (history, shruti/swara, thalam, ragam, concert practice). Wording is original.
 */

export type TheoryQuizTopic =
  | "all"
  | "fundamentals"
  | "swaras"
  | "tala"
  | "forms";

export type TheoryQuizDifficulty = "beginner" | "intermediate" | "advanced";

export type TheoryQuizQuestion = {
  id: string;
  topic: Exclude<TheoryQuizTopic, "all">;
  difficulty: TheoryQuizDifficulty;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
};

export const THEORY_QUIZ_TOPICS: {
  id: TheoryQuizTopic;
  label: string;
  description: string;
}[] = [
  { id: "all", label: "All topics", description: "" },
  { id: "fundamentals", label: "History", description: "" },
  { id: "swaras", label: "Shruti & swara", description: "" },
  { id: "tala", label: "Laya & thalam", description: "" },
  { id: "forms", label: "Ragam", description: "" },
];

export const THEORY_QUIZ_DIFFICULTIES: {
  id: TheoryQuizDifficulty;
  label: string;
}[] = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

export const THEORY_QUIZ_QUESTIONS: TheoryQuizQuestion[] = [
  // —— Overview / fundamentals ——
  {
    id: "f1",
    topic: "fundamentals",
    difficulty: "beginner",
    prompt: "Carnatic music is best described as:",
    options: [
      "Classical art music from South India",
      "Folk music from North India only",
      "A modern film-music style from Mumbai",
      "Percussion-only temple drumming",
    ],
    correctIndex: 0,
    explanation:
      "Carnatic music is the South Indian branch of Indian classical music, distinct from Hindustani traditions of the north.",
  },
  {
    id: "f2",
    topic: "fundamentals",
    difficulty: "beginner",
    prompt: "Hindustani and Carnatic music are generally said to have diverged around:",
    options: [
      "The 12th century CE",
      "The year 2000 CE",
      "Ancient Egypt",
      "The Baroque era in Europe only",
    ],
    correctIndex: 0,
    explanation:
      "By roughly the 12th century, northern and southern classical streams developed separate practices and repertoires.",
  },
  {
    id: "f3",
    topic: "fundamentals",
    difficulty: "beginner",
    prompt: "Which Vedic text is often cited as an early root of Indian sacred music?",
    options: ["Sama Veda", "Atharva Veda only", "Iliad", "Gospel of Mark"],
    correctIndex: 0,
    explanation: "The Sama Veda contains chants whose musical delivery influenced later classical traditions.",
  },
  {
    id: "f4",
    topic: "fundamentals",
    difficulty: "beginner",
    prompt: "Purandara Dasa (15th century) is widely honoured as:",
    options: [
      "A father-figure who systematized early Carnatic pedagogy",
      "The inventor of the piano in India",
      "A Mughal emperor who banned music",
      "The only Trinity composer",
    ],
    correctIndex: 0,
    explanation:
      "He is called Pitamaha for organizing foundational exercises and simple compositions still used in teaching.",
  },
  {
    id: "f5",
    topic: "fundamentals",
    difficulty: "beginner",
    prompt: "The “Trinity” of Carnatic composers (18th century) includes:",
    options: [
      "Tyagaraja, Muthuswami Dikshitar, and Shyama Sastry",
      "Bach, Mozart, and Beethoven",
      "Only Purandara Dasa",
      "Three anonymous court drummers",
    ],
    correctIndex: 0,
    explanation:
      "These three composers left a vast legacy of kritis that shaped modern concert repertoire.",
  },
  {
    id: "f6",
    topic: "fundamentals",
    difficulty: "beginner",
    prompt: "A typical contemporary Carnatic concert trio on stage often features:",
    options: [
      "Vocalist (or soloist), violin, and mridangam",
      "Sitar, tabla, and bansuri only",
      "Electric guitar, bass, and drums",
      "Choir and organ",
    ],
    correctIndex: 0,
    explanation:
      "Voice or melodic solo is supported by violin for melodic response and mridangam for rhythm.",
  },
  {
    id: "f7",
    topic: "fundamentals",
    difficulty: "intermediate",
    prompt: "The violin entered Carnatic concerts largely because:",
    options: [
      "Baluswami Dikshitar adapted the Western violin to South Indian melody",
      "Tyagaraja invented it in a dream",
      "British law required it in temples",
      "It replaced mridangam in all concerts",
    ],
    correctIndex: 0,
    explanation:
      "Early 19th century, Muthuswami Dikshitar’s brother learned the Western violin and fit it to gamaka-rich melody.",
  },
  {
    id: "f8",
    topic: "fundamentals",
    difficulty: "beginner",
    prompt: "The four major elements of Carnatic music are:",
    options: [
      "Shruti, swara, laya, and ragam",
      "Only lyrics and costumes",
      "Harmony, counterpoint, and fugue",
      "DJ, remix, and autotune",
    ],
    correctIndex: 0,
    explanation:
      "Pitch reference, notes, rhythm, and melodic framework together define the system.",
  },
  {
    id: "f9",
    topic: "fundamentals",
    difficulty: "intermediate",
    prompt: "The saying “Shruthi Maatha Layam Pitha” suggests:",
    options: [
      "Shruti is like a mother and laya (rhythm) like a father to music",
      "Only women may sing shruti",
      "Rhythm has no role in Carnatic music",
      "Layam means the same as ragam",
    ],
    correctIndex: 0,
    explanation:
      "It stresses how pitch foundation and rhythmic discipline nurture every performance.",
  },
  {
    id: "f10",
    topic: "fundamentals",
    difficulty: "intermediate",
    prompt: "Hindustani music differs from Carnatic mainly in that Hindustani:",
    options: [
      "Developed with stronger Persian and North Indian court influences",
      "Uses no rhythm at all",
      "Has no vocal tradition",
      "Is only performed in Kerala",
    ],
    correctIndex: 0,
    explanation:
      "Northern classical music absorbed Persianate aesthetics; Carnatic stayed closer to southern temple and court lineages.",
  },
  {
    id: "f11",
    topic: "fundamentals",
    difficulty: "beginner",
    prompt: "Compositions in Carnatic concerts are often sung in:",
    options: [
      "Telugu, Sanskrit, Tamil, and Kannada",
      "Only English and French",
      "Latin liturgy exclusively",
      "Wordless humming only",
    ],
    correctIndex: 0,
    explanation:
      "Major South Indian languages plus Sanskrit carry most classical sahitya.",
  },

  // —— Shruti & swara ——
  {
    id: "s1",
    topic: "swaras",
    difficulty: "beginner",
    prompt: "In Carnatic practice, shruti most closely corresponds to:",
    options: [
      "The tonic or key pitch that anchors a piece",
      "A type of seven-beat dance",
      "The final blessing of a concert",
      "A percussion solo",
    ],
    correctIndex: 0,
    explanation:
      "Shruti is the reference pitch — like the key — from which other swaras are measured.",
  },
  {
    id: "s2",
    topic: "swaras",
    difficulty: "beginner",
    prompt: "Carnatic swaras are described as relative because:",
    options: [
      "Their pitch depends on the chosen shruti, not fixed Western frequencies",
      "They never change within a concert",
      "Only Pa can move up and down",
      "They are written in bass clef only",
    ],
    correctIndex: 0,
    explanation:
      "Move the drone and the whole scale moves — intervals matter more than absolute Hz.",
  },
  {
    id: "s3",
    topic: "swaras",
    difficulty: "beginner",
    prompt: "How many basic swaras (saptha swarams) are in the system?",
    options: ["Five", "Six", "Seven", "Seventy-two"],
    correctIndex: 2,
    explanation: "Sa, Ri, Ga, Ma, Pa, Dha, and Ni are the seven core note names.",
  },
  {
    id: "s4",
    topic: "swaras",
    difficulty: "beginner",
    prompt: "Which pair is often used together to establish shruti in practice?",
    options: [
      "Shadjam (Sa) and Panchamam (Pa)",
      "Only Ni and Ni",
      "Ma and Ma at random",
      "Silence and noise",
    ],
    correctIndex: 0,
    explanation:
      "The perfect fifth (Pa) above Sa is a stable drone pair heard in tambura or electronic shruti.",
  },
  {
    id: "s5",
    topic: "swaras",
    difficulty: "intermediate",
    prompt: "The term “swaram” (swara) means:",
    options: [
      "A musical note defined relative to shruti",
      "A seven-hour concert",
      "A type of mridangam stroke",
      "A copyright license",
    ],
    correctIndex: 0,
    explanation: "Each swara is a solfege-like name for a scale degree, not an absolute concert pitch.",
  },
  {
    id: "s6",
    topic: "swaras",
    difficulty: "intermediate",
    prompt: "How many swarasthanas (distinct note placements) does the system use in full?",
    options: ["7", "10", "12", "16"],
    correctIndex: 3,
    explanation:
      "With variants of Ri, Ga, Ma, Dha, and Ni plus fixed Sa and Pa, sixteen placements are recognized.",
  },
  {
    id: "s7",
    topic: "swaras",
    difficulty: "beginner",
    prompt: "“Gandharam” is the traditional name for:",
    options: ["Ga (the third degree)", "The tala cycle", "A mangalam", "A violin bow"],
    correctIndex: 0,
    explanation: "The seven swaras have Sanskrit names — Gandharam is Ga.",
  },
  {
    id: "s8",
    topic: "swaras",
    difficulty: "intermediate",
    prompt: "“Any sound heard by the ear is called shruti” in theory highlights that:",
    options: [
      "Pitch perception begins with audible sound before naming swaras",
      "Shruti means only silence",
      "Only electronic tuners count",
      "Shruti and ragam are identical",
    ],
    correctIndex: 0,
    explanation:
      "Shruti is the sonic foundation from which the ordered swara system is built.",
  },
  {
    id: "s9",
    topic: "swaras",
    difficulty: "advanced",
    prompt: "If a student raises the concert shruti (tonic), what happens to swara names?",
    options: [
      "They keep the same names; physical pitch shifts with the drone",
      "Sa becomes Pa automatically",
      "All lyrics change language",
      "Talam becomes 7/8 only",
    ],
    correctIndex: 0,
    explanation:
      "Sa is always Sa relative to the drone — the whole scale transposes.",
  },

  // —— Laya & thalam ——
  {
    id: "t1",
    topic: "tala",
    difficulty: "beginner",
    prompt: "“Laya” in Carnatic music refers to:",
    options: ["Rhythm or tempo flow", "A raga’s scale", "Stage lighting", "Lyric poetry"],
    correctIndex: 0,
    explanation: "Laya is the time dimension — how fast and steady the music moves.",
  },
  {
    id: "t2",
    topic: "tala",
    difficulty: "beginner",
    prompt: "“Thalam” (tala) is closest in role to:",
    options: [
      "A time signature or metric cycle in Western music",
      "A type of vocal ornament",
      "The audience’s applause",
      "A composer's biography",
    ],
    correctIndex: 0,
    explanation:
      "Tala organizes beats into repeating cycles, like 4/4 or other meters.",
  },
  {
    id: "t3",
    topic: "tala",
    difficulty: "beginner",
    prompt: "Adi thalam is often compared to which Western meter?",
    options: ["4/4", "3/4 only", "12/8 jazz waltz", "No meter at all"],
    correctIndex: 0,
    explanation: "Adi is the most common cycle and feels like a four-beat bar.",
  },
  {
    id: "t4",
    topic: "tala",
    difficulty: "intermediate",
    prompt: "How many fundamental (sapta) thalas are there?",
    options: ["5", "7", "12", "72"],
    correctIndex: 1,
    explanation:
      "Dhruva, Matya, Rupaka, Jampa, Triputa, Ata, and Eka are the seven root talas.",
  },
  {
    id: "t5",
    topic: "tala",
    difficulty: "intermediate",
    prompt: "The anga pattern for Rupaka thalam is:",
    options: ["O I (drutam + laghu)", "I O I I", "I I O O", "I alone"],
    correctIndex: 0,
    explanation: "Rupaka begins with a wave-beat (O) followed by a finger-count laghu (I).",
  },
  {
    id: "t6",
    topic: "tala",
    difficulty: "intermediate",
    prompt: "Eka thalam consists of:",
    options: ["A single laghu (I)", "Eight drutams only", "No beats", "Two ragas"],
    correctIndex: 0,
    explanation: "Eka is the simplest saptha tala — one laghu defines the cycle.",
  },
  {
    id: "t7",
    topic: "tala",
    difficulty: "intermediate",
    prompt: "Dhruva thalam’s basic pattern is:",
    options: ["I O I I", "O I", "I U O", "I O O"],
    correctIndex: 0,
    explanation: "Laghu, drutam, laghu, laghu — the longest common saptha pattern.",
  },
  {
    id: "t8",
    topic: "tala",
    difficulty: "advanced",
    prompt: "Different versions of the same saptha tala arise mainly from changing:",
    options: [
      "Laghu length (jati) and other anga details",
      "The raga’s arohanam only",
      "The concert hall size",
      "Whether violin is used",
    ],
    correctIndex: 0,
    explanation:
      "Jati (counts in the laghu) and classifications yield many practical tala variants from seven roots.",
  },
  {
    id: "t9",
    topic: "tala",
    difficulty: "beginner",
    prompt: "Triputa thalam’s symbol pattern is:",
    options: ["I O O", "O I", "I O I", "I I O O"],
    correctIndex: 0,
    explanation: "One laghu followed by two drutams — I O O.",
  },
  {
    id: "t10",
    topic: "tala",
    difficulty: "advanced",
    prompt: "Jampa thalam includes which special anga between beats?",
    options: [
      "Anudrutam (U) — a light single beat",
      "A full Western chord",
      "A vocal alapana",
      "A mangalam only",
    ],
    correctIndex: 0,
    explanation: "Jampa’s pattern I U O uses the short anudrutam (U) anga.",
  },

  // —— Ragam, forms, concert ——
  {
    id: "r1",
    topic: "forms",
    difficulty: "beginner",
    prompt: "A ragam is best described as:",
    options: [
      "A melodic framework of notes, phrases, and mood",
      "A percussion instrument",
      "The ticket price of a concert",
      "A type of microphone",
    ],
    correctIndex: 0,
    explanation:
      "Raga is more than a scale — it includes characteristic phrases and expressive identity.",
  },
  {
    id: "r2",
    topic: "forms",
    difficulty: "beginner",
    prompt: "The 72 Melakarta ragas are:",
    options: [
      "Principal parent scales in the South Indian system",
      "The number of strings on a violin",
      "Only talas, not ragas",
      "European major keys",
    ],
    correctIndex: 0,
    explanation:
      "Melakarta is the systematic set of parent ragas; thousands of janya ragas derive from them.",
  },
  {
    id: "r3",
    topic: "forms",
    difficulty: "beginner",
    prompt: "Arohanam and avarohanam mean:",
    options: [
      "Ascending and descending scale of a ragam",
      "First and last song of a concert",
      "Two types of mridangam",
      "Copyright and royalty",
    ],
    correctIndex: 0,
    explanation:
      "They list which swaras appear going up and down — but alone they do not fully define a raga.",
  },
  {
    id: "r4",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "Two ragas can share the same notes yet sound different because:",
    options: [
      "Motifs, gamakas, and emphasis create a distinct feel",
      "The law forbids duplicate scales",
      "They must use different languages",
      "Only one may use Pa",
    ],
    correctIndex: 0,
    explanation:
      "Phrase order and ornamentation (e.g. Anandabhairavi vs Reethigowla) separate ragas with similar swaras.",
  },
  {
    id: "r5",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "Ragam Mohanam’s scale shape is often likened to:",
    options: [
      "A major pentatonic (five-tone) pattern",
      "A twelve-tone serial row",
      "Only three notes total",
      "No scale at all",
    ],
    correctIndex: 0,
    explanation: "Mohanam uses Sa Ri Ga Pa Dha — a five-note ascent common in many traditions.",
  },
  {
    id: "r6",
    topic: "forms",
    difficulty: "beginner",
    prompt: "Sarali varisai and janta varisai are:",
    options: [
      "Early exercises before geetham and harder forms",
      "Names of thalas only",
      "Types of audience seating",
      "Final mangalam songs",
    ],
    correctIndex: 0,
    explanation:
      "They teach steady swara and tala basics — the first steps in traditional lessons.",
  },
  {
    id: "r7",
    topic: "forms",
    difficulty: "beginner",
    prompt: "A geetham in the lesson path usually comes:",
    options: [
      "After alankaram, as a simple composed song with swara and sahitya",
      "Before learning any swara names",
      "Only after a three-hour RTP",
      "Only in Hindustani music",
    ],
    correctIndex: 0,
    explanation:
      "Geetham bridges exercises and heavier forms like varnam and kriti.",
  },
  {
    id: "r8",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "Which item is typically heavier and more advanced than a geetham?",
    options: ["Varnam", "Sarali varisai", "Shruti box hum", "Tuning the violin"],
    correctIndex: 0,
    explanation:
      "Varnam trains pace, gamakas, and tala rigour — a gateway to concert repertoire.",
  },
  {
    id: "r9",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "“Manodharma sangeetham” emphasizes:",
    options: [
      "Improvisation guided by the artist’s musical imagination",
      "Reading fixed Western scores only",
      "Replacing all tala with silence",
      "Dancing without music",
    ],
    correctIndex: 0,
    explanation:
      "Manodharma means music from the mind/heart — alapana, tanam, pallavi, kalpana swaram, etc.",
  },
  {
    id: "r10",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "Raga alapana is characterized by:",
    options: [
      "Slow, rhythm-free exploration of a ragam before a composition",
      "A fixed four-bar drum solo",
      "Only singing sahitya at full speed",
      "Using only Western harmony",
    ],
    correctIndex: 0,
    explanation:
      "Alapana introduces the raga’s colour without tala, often with syllables like ta, dha, ri, na.",
  },
  {
    id: "r11",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "Tanam differs from alapana mainly because tanam:",
    options: [
      "Uses looser rhythmic pulse and is generally faster",
      "Has no melody at all",
      "Is always sung in English",
      "Replaces the violin with tabla",
    ],
    correctIndex: 0,
    explanation:
      "Tanam keeps improvisatory raga work but rides a pulsing, semi-rhythmic feel.",
  },
  {
    id: "r12",
    topic: "forms",
    difficulty: "advanced",
    prompt: "In a pallavi section, rhythm is central because:",
    options: [
      "A lyric line is stretched and improvised within a fixed tala cycle",
      "There is never any percussion",
      "The raga must change every beat",
      "Only the audience claps",
    ],
    correctIndex: 0,
    explanation:
      "Pallavi improvisation weaves melody and rhythm around one sahitya line for a full avarta.",
  },
  {
    id: "r13",
    topic: "forms",
    difficulty: "beginner",
    prompt: "Gamakas are:",
    options: [
      "Ornaments — slides and oscillations between notes",
      "Types of concert tickets",
      "Only tabla bols",
      "Legal contracts for musicians",
    ],
    correctIndex: 0,
    explanation:
      "Gamakas shape ragam identity; Carnatic melody relies on them heavily.",
  },
  {
    id: "r14",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "“Kampita” among gamakas is notable as:",
    options: [
      "One of the most important oscillation types",
      "A replacement for all talas",
      "A language spoken on stage",
      "The first song in every concert",
    ],
    correctIndex: 0,
    explanation:
      "Kampita is a vibrato-like oscillation on a note — essential in many ragas.",
  },
  {
    id: "r15",
    topic: "forms",
    difficulty: "beginner",
    prompt: "A full contemporary Carnatic concert often ends with:",
    options: [
      "A mangalam (auspicious closing piece)",
      "Another three-hour alapana only",
      "Silence with no music",
      "A rock guitar solo only",
    ],
    correctIndex: 0,
    explanation:
      "After main items and lighter pieces, mangalam blesses and closes the recital.",
  },
  {
    id: "r16",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "A typical long concert might include RTP (ragam–tanam–pallavi), which is:",
    options: [
      "A major improvisatory suite on one ragam",
      "A five-minute tuning check only",
      "A Hindustani dhrupad form only",
      "A copyright form",
    ],
    correctIndex: 0,
    explanation:
      "RTP chains alapana-style exploration, tanam, and rhythmic pallavi — a concert highlight.",
  },
  {
    id: "r17",
    topic: "forms",
    difficulty: "advanced",
    prompt: "In ragam Hindolam, the Dhaivatham note may be performed with:",
    options: [
      "Oscillation between D1 and D2 to capture the raga’s feel",
      "No gamaka at all by rule",
      "Only Western staccato",
      "Silence instead of Dha",
    ],
    correctIndex: 0,
    explanation:
      "Even when the scale lists D1, the performed gamaka may brush D2 for the true Hindolam colour.",
  },
  {
    id: "r18",
    topic: "forms",
    difficulty: "beginner",
    prompt: "A thillana in concert is often:",
    options: [
      "A lively rhythmic closing or penultimate dance-like piece",
      "The very first alapana of the day",
      "Only a shruti demonstration",
      "A tuning exercise for mridangam",
    ],
    correctIndex: 0,
    explanation:
      "Tillanas feature brisk rhythm and sollus — popular near the end of a recital.",
  },

  // Cross-topic extras
  {
    id: "x1",
    topic: "fundamentals",
    difficulty: "intermediate",
    prompt: "The violin suits Carnatic melody especially because it can:",
    options: [
      "Execute continuous gamakas and slides between swaras",
      "Play only single fixed pitches with no ornament",
      "Replace lyrics entirely",
      "Ignore shruti completely",
    ],
    correctIndex: 0,
    explanation:
      "Fretless bowing matches the continuous pitch bends central to ragam expression.",
  },
  {
    id: "x2",
    topic: "tala",
    difficulty: "beginner",
    prompt: "Matya thalam’s pattern is:",
    options: ["I O I", "O I", "I O O", "I O I I"],
    correctIndex: 0,
    explanation: "Laghu, drutam, laghu — three angas in Matya.",
  },
  {
    id: "x3",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "Kalpana swaram is:",
    options: [
      "Improvised swara passages at the end of a composition section",
      "A type of shruti box",
      "The opening mangalam",
      "A dance costume",
    ],
    correctIndex: 0,
    explanation:
      "Singers weave spontaneous swara patterns over the tala before returning to the pallavi line.",
  },
  {
    id: "x4",
    topic: "swaras",
    difficulty: "beginner",
    prompt: "“Nishadham” is the name for:",
    options: ["Ni (the seventh degree)", "Sa", "The tala hand wave", "A kriti composer"],
    correctIndex: 0,
    explanation: "Ni is called Nishadham in the traditional seven-swara naming.",
  },
  {
    id: "x5",
    topic: "fundamentals",
    difficulty: "advanced",
    prompt: "Western artists have also experimented with Carnatic music using:",
    options: [
      "Keyboard, viola, and cello among other instruments",
      "Only instruments banned in India",
      "No melodic instruments ever",
      "Only autotune without shruti",
    ],
    correctIndex: 0,
    explanation:
      "Beyond violin, musicians try other bowed and keyed instruments while adapting gamakas.",
  },

  // —— Beginner MC set (introductory pedagogy) ——
  {
    id: "mc-b01",
    topic: "swaras",
    difficulty: "beginner",
    prompt: "What are the seven basic swaras in Carnatic music called?",
    options: [
      "Sa Ri Ga Ma Pa Dha Ni",
      "Do Re Mi Fa Sol La Ti",
      "Ta Ka Di Mi Ta Ka Jo Nu",
      "Alaap Tanam Pallavi",
    ],
    correctIndex: 0,
    explanation:
      "These solfege syllables (saptha swarams) name the seven scale degrees relative to shruti.",
  },
  {
    id: "mc-b02",
    topic: "swaras",
    difficulty: "beginner",
    prompt: "Which swara is considered fixed in pitch?",
    options: ["Ri", "Ga", "Sa", "Dha"],
    correctIndex: 2,
    explanation:
      "Shadjam (Sa) is the immovable tonic; other swaras are measured as intervals from it.",
  },
  {
    id: "mc-b03",
    topic: "forms",
    difficulty: "beginner",
    prompt: "What is a raga?",
    options: [
      "A percussion instrument",
      "A melodic framework",
      "A type of concert hall",
      "A rhythm cycle",
    ],
    correctIndex: 1,
    explanation:
      "A raga is a melodic system of notes, phrases, and mood — not merely a drum pattern or venue.",
  },
  {
    id: "mc-b04",
    topic: "tala",
    difficulty: "beginner",
    prompt: "What is tala in Carnatic music?",
    options: ["Melody", "Voice training", "Rhythm cycle", "Musical instrument"],
    correctIndex: 2,
    explanation: "Tala (thalam) organizes time into repeating beat cycles for composition and improvisation.",
  },
  {
    id: "mc-b05",
    topic: "tala",
    difficulty: "beginner",
    prompt: "How many beats are there in Adi Tala?",
    options: ["4", "6", "8", "16"],
    correctIndex: 2,
    explanation:
      "Adi tala is commonly counted as eight beats (often felt as two groups of four).",
  },
  {
    id: "mc-b06",
    topic: "swaras",
    difficulty: "beginner",
    prompt: "Which instrument provides the drone or background pitch?",
    options: ["Mridangam", "Violin", "Flute", "Tambura"],
    correctIndex: 3,
    explanation:
      "The tambura (tanpura) sustains Sa and Pa (or other drone notes) so melody stays anchored to shruti.",
  },
  {
    id: "mc-b07",
    topic: "forms",
    difficulty: "beginner",
    prompt: "Which raga is commonly taught first to beginners?",
    options: ["Kalyani", "Todi", "Mayamalavagowla", "Bhairavi"],
    correctIndex: 2,
    explanation:
      "Mayamalavagowla is the standard first raga in many syllabi because of its balanced scale and exercises.",
  },
  {
    id: "mc-b08",
    topic: "forms",
    difficulty: "beginner",
    prompt: "What are Sarali Varisai exercises mainly used for?",
    options: [
      "Dance practice",
      "Rhythm improvisation",
      "Basic swara practice",
      "Instrument tuning",
    ],
    correctIndex: 2,
    explanation:
      "Sarali varisai are stepwise swara drills — the first structured vocal exercises after alankarams.",
  },
  {
    id: "mc-b09",
    topic: "forms",
    difficulty: "beginner",
    prompt: "What is the ascending order of notes in a raga called?",
    options: ["Avarohanam", "Pallavi", "Kriti", "Arohanam"],
    correctIndex: 3,
    explanation: "Arohanam lists the swaras going up; avarohanam is the descending pattern.",
  },
  {
    id: "mc-b10",
    topic: "fundamentals",
    difficulty: "beginner",
    prompt: "Who is one of the Carnatic Music Trinity composers?",
    options: ["Tyagaraja", "A. R. Rahman", "Lata Mangeshkar", "Kishore Kumar"],
    correctIndex: 0,
    explanation:
      "Tyagaraja is one of the Trinity (with Muthuswami Dikshitar and Shyama Sastry), prolific in Telugu kritis.",
  },

  // —— Intermediate MC set ——
  {
    id: "mc-i01",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "What is the total number of Melakarta ragas in Carnatic music?",
    options: ["36", "72", "108", "144"],
    correctIndex: 1,
    explanation:
      "The 72 melakarta system classifies parent ragas; countless janya ragas derive from them.",
  },
  {
    id: "mc-i02",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "Which of the following is a Janya raga?",
    options: ["Kalyani", "Shankarabharanam", "Harikambhoji", "Hamsadhwani"],
    correctIndex: 3,
    explanation:
      "Hamsadhwani is a pentatonic janya (derived raga); the others listed are melakarta parents.",
  },
  {
    id: "mc-i03",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "What does “Manodharma Sangeetham” refer to?",
    options: [
      "Written notation",
      "Group singing",
      "Improvisation in music",
      "Dance accompaniment",
    ],
    correctIndex: 2,
    explanation:
      "Manodharma is music from the mind — alapana, niraval, kalpana swaram, and similar spontaneous creation.",
  },
  {
    id: "mc-i04",
    topic: "tala",
    difficulty: "intermediate",
    prompt: "Which tala has 7 beats in its common form?",
    options: ["Adi Tala", "Rupaka Tala", "Misra Chapu Tala", "Khanda Chapu Tala"],
    correctIndex: 2,
    explanation:
      "Misra Chapu is often taught as a 3+4 (seven-beat) asymmetric cycle in concert practice.",
  },
  {
    id: "mc-i05",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "What is the purpose of gamakas in Carnatic music?",
    options: [
      "To maintain tala",
      "To decorate and give identity to ragas",
      "To tune instruments",
      "To increase concert volume",
    ],
    correctIndex: 1,
    explanation:
      "Gamakas are melodic ornaments — slides and oscillations that define how a raga sounds.",
  },
  {
    id: "mc-i06",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "Which part of a kriti usually contains the main thematic line?",
    options: ["Charanam", "Pallavi", "Swarakalpana", "Niraval"],
    correctIndex: 1,
    explanation:
      "The pallavi is the opening refrain and thematic anchor; charanam verses develop the idea.",
  },
  {
    id: "mc-i07",
    topic: "fundamentals",
    difficulty: "intermediate",
    prompt: "Which composer is especially known for compositions in Sanskrit?",
    options: ["Tyagaraja", "Syama Sastri", "Muthuswami Dikshitar", "Purandara Dasa"],
    correctIndex: 2,
    explanation:
      "Dikshitar’s kritis are largely in Sanskrit and often praise deities with rich raga treatment.",
  },
  {
    id: "mc-i08",
    topic: "forms",
    difficulty: "intermediate",
    prompt: "What does “Avarohanam” mean?",
    options: [
      "Ascending scale",
      "Descending scale",
      "Rhythmic cycle",
      "Improvised singing",
    ],
    correctIndex: 1,
    explanation: "Avarohanam is the descending scale pattern of a raga (arohanam is ascending).",
  },
  {
    id: "mc-i09",
    topic: "fundamentals",
    difficulty: "intermediate",
    prompt: "In Carnatic concerts, what usually follows the alapana?",
    options: [
      "Tani Avartanam",
      "Ragam-Tanam-Pallavi",
      "Kriti rendition",
      "Mangalam",
    ],
    correctIndex: 2,
    explanation:
      "After exploring the raga in alapana, the main composition (kriti) is typically presented with tala.",
  },
  {
    id: "mc-i10",
    topic: "tala",
    difficulty: "intermediate",
    prompt: "Which percussion instrument is most commonly used in Carnatic concerts?",
    options: ["Tabla", "Ghatam", "Mridangam", "Dholak"],
    correctIndex: 2,
    explanation:
      "The mridangam is the primary South Indian concert drum; ghatam and kanjira often accompany it.",
  },
];

export function theoryQuestionsForFilter(
  topic: TheoryQuizTopic,
  difficulty: TheoryQuizDifficulty,
): TheoryQuizQuestion[] {
  return THEORY_QUIZ_QUESTIONS.filter((q) => {
    if (q.difficulty !== difficulty) return false;
    if (topic === "all") return true;
    return q.topic === topic;
  });
}
