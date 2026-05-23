export type WarmupRagaHelpTopic = "ragaType" | "janyaMelakarta" | "swaras";

export const WARMUP_RAGA_HELP_TOPICS: readonly {
  id: WarmupRagaHelpTopic;
  label: string;
}[] = [
  { id: "ragaType", label: "What is Raga type?" },
  { id: "janyaMelakarta", label: "What are janya and melakarta rāgas?" },
  { id: "swaras", label: "What are the different swaras?" },
];

export const WARMUP_RAGA_HELP_TEXT: Record<WarmupRagaHelpTopic, string> = {
  ragaType: `Rāga type describes how many distinct swaras appear in the arohanam (ascent) and avarohanam (descent):

• Audava — 5 swaras in that direction
• Shadava — 6 swaras
• Sampoorna — all 7 swaras (Sa, Ri, Ga, Ma, Pa, Dha, Ni)

When ascent and descent differ, both are shown — for example Audava–Sampoorna means five swaras going up and seven coming down. The label here is counted from the scale notation shown for your chosen rāga.`,
  janyaMelakarta: `The 72 melakarta rāgas are the parent scales in the South Indian melakarta system. Each has a full sampoorna scale in both directions (with standard Ri/Ga, Ma, Dha/Ni variants for that number).

A janya rāga is derived from one of these parents: it uses a subset or particular ordering of swaras taken from that melakarta’s allowed notes. The “Melakarta / parent” line names which parent (and its number) your rāga belongs to.

If the chosen rāga is itself one of the 72 melakartas, classification is simply Melakarta rāga — it is a parent scale, not a derivative.`,
  swaras: `There are 12 swarasthanas — distinct pitch places — used on this warmup chart (plus Ṡ, upper-octave Sa). Seven are sapta swarams in name (Sa, Ri, Ga, Ma, Pa, Dha, Ni); each of Ri, Ga, Ma, Dha, and Ni can take different forms (subscripts R₁ R₂ … N₃).

The 12 swarasthanas shown here:

• Sa (Shadjam)
• R₁ (Shuddha Rishabham)
• R₂ (Chatusruthi Rishabham)
• G₂ (Sadharana Gandharam)
• G₃ (Antara Gandharam)
• M₁ (Shuddha Madhyamam)
• M₂ (Prati Madhyamam)
• Pa (Panchamam)
• D₁ (Shuddha Dhaivatham)
• D₂ (Chatushruthi Dhaivatham)
• N₂ (Kakali Nishadham)
• N₃ (highest ni swarasthana in the 12)

These share the same frequency as another swarasthana and are not separate buttons on this tuner:

• G₁ — same as R₂ (Shuddha Gandharam = Chatusruthi Rishabham)
• R₃ — same as G₂ (Shatsruthi Rishabham = Sadharana Gandharam)
• N₁ — same as D₂ (Shuddha Nishadham = Chatushruthi Dhaivatham)
• D₃ — same as N₂

Rāga notation may still write G₁, R₃, N₁, or D₃; pitch matching treats them as their partners above. Sa is your shruti (tonic) from the Shruti dropdown.`,
};
