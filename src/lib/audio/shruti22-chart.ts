/**
 * Printed 22-shruti frequency chart (Hz): 12 columns (C … B) + B# as octave Sa (same ratios as C,
 * scaled by chart octave Sa). Row 1 = Shadja for that column; rows 2–22 complete the octave to
 * doubling Sa. Values match the user-provided chart transcription.
 */

const SA_C = 261.6255528;
const SA_BSHARP = 523.2511025;

/** C (Saphet 1) — 22 rows. */
const COL_C: readonly number[] = [
  261.6255528, 275.6219814, 279.0672562, 290.6950583, 294.3287466, 310.0747288, 313.9506629,
  327.0319403, 331.1198396, 348.8340695, 353.1944954, 367.9109325, 372.5098191, 392.4383278,
  413.4329707, 418.6008829, 436.042586, 441.4931183, 465.1120916, 470.9259927, 490.5479088,
  496.6797576,
];

const COL_CSHARP: readonly number[] = [
  277.1826192, 292.0113189, 295.6614603, 307.9806877, 311.8304463, 328.5127334, 332.6191425,
  346.4782733, 350.8092517, 369.5768247, 374.196535, 389.788057, 394.6604077, 415.7739273,
  438.0169768, 443.492189, 461.9710299, 467.7456678, 492.7690984, 498.9287121, 519.7174081,
  526.2138757,
];

const COL_D: readonly number[] = [
  293.664757, 309.3752171, 313.2424073, 326.2941741, 330.3728513, 348.0471189, 352.3977079,
  367.0809455, 371.6694573, 391.5530084, 396.447421, 412.9660632, 418.128139, 440.497134,
  464.0628241, 469.8636094, 489.4412595, 495.5592752, 522.0706766, 528.59656, 550.6214163,
  557.5041841,
];

/** Chart “E flat (Kali 2)” — app key `kattai_2_5` (D#). */
const COL_EB: readonly number[] = [
  311.1269738, 327.7716266, 331.8687719, 345.6966372, 350.0178452, 368.7430795, 373.352368,
  388.9087164, 393.7700754, 414.8359641, 420.0214136, 437.5223056, 442.9913344, 466.6904591,
  491.6574382, 497.8031562, 518.544954, 525.026766, 553.1146174, 560.0285501, 583.3630727,
  590.6551111,
];

const COL_E: readonly number[] = [
  329.6275481, 347.2619436, 351.6027179, 366.2528309, 370.8309913, 390.6696861, 395.5530572,
  412.0344343, 417.1846848, 439.5033965, 444.9971889, 463.5387382, 469.3329724, 494.4413205,
  520.8929136, 527.404075, 549.3792445, 556.246485, 586.0045272, 593.3295838, 618.0516494,
  625.777295,
];

const COL_F: readonly number[] = [
  349.228224, 367.9112153, 372.5101055, 388.0313596, 392.8817516, 413.9001168, 419.0738682,
  436.5352791, 441.9919701, 465.6376309, 471.4581013, 491.1021885, 497.2409659, 523.8423342,
  551.866821, 558.7651563, 582.0470374, 589.3226254, 620.850173, 628.6108002, 654.8029165,
  662.9879529,
];

const COL_FSHARP: readonly number[] = [
  369.9944168, 389.7883567, 394.6607111, 411.1049071, 416.2437185, 438.5119008, 443.9932996,
  462.4930201, 468.2741828, 493.3258879, 499.4924615, 520.3046471, 526.8084551, 554.9916233,
  584.682533, 591.9910647, 616.6573586, 624.3655756, 657.767849, 665.9899471, 693.7395278,
  702.4112719,
];

const COL_G: readonly number[] = [
  391.9954318, 412.9663807, 418.1284604, 435.5504793, 440.9948603, 464.5871778, 470.3945175,
  489.9942888, 496.1192174, 522.6605745, 529.1938317, 551.2435743, 558.134119, 587.9931457,
  619.4495689, 627.1926885, 653.3257168, 661.4922883, 696.8807643, 705.5917739, 734.9914307,
  744.1788236,
];

/** Chart “A flat (Kali 4)” — app key `kattai_5_5` (G#). */
const COL_AB: readonly number[] = [
  415.3046954, 437.5226419, 442.9916749, 461.4496611, 467.2177818, 492.2129716, 498.3656338,
  519.1308682, 525.620004, 553.7395925, 560.6613374, 584.0222261, 591.3225039, 622.9570409,
  656.2839606, 664.4875101, 692.1744892, 700.8266704, 738.3194549, 747.5484481, 778.6962996,
  788.4300034,
];

const COL_A: readonly number[] = [
  440, 463.5390945, 469.3333332, 488.8888884, 494.9999995, 521.4814808, 527.9999993, 549.9999989,
  556.8749989, 586.6666653, 593.9999986, 618.7499981, 626.4843731, 659.9999978, 695.3086394,
  703.9999974, 733.3333301, 742.4999967, 782.2222185, 791.9999962, 824.9999955, 835.3124955,
];

/** Chart “B flat (Kali 5)” — app key `kattai_6_5` (A#). */
const COL_BB: readonly number[] = [
  466.163764, 491.102566, 497.2413481, 517.9597373, 524.434234, 552.4903862, 559.396516,
  582.7047038, 589.9885126, 621.5516839, 629.3210799, 655.5427911, 663.737076, 699.2456436,
  736.6538465, 745.8620196, 776.9396033, 786.6513483, 828.7355765, 839.0947712, 874.0570528,
  884.9827659,
];

const COL_B: readonly number[] = [
  493.8833065, 520.305047, 526.8088601, 548.7592289, 555.6187193, 585.3431773, 592.659967,
  617.3541319, 625.0710585, 658.5110738, 666.7424622, 694.5233977, 703.2049402, 740.8249573,
  780.4575679, 790.2132875, 823.1388406, 833.4280761, 878.014763, 888.9899475, 926.0311947,
  937.6065846,
];

/** B# (7½): same relative curve as C, Sa = chart octave Shadja for that step. */
const COL_BSHARP: readonly number[] = COL_C.map((hz) => (hz * SA_BSHARP) / SA_C);

function assert22(name: string, col: readonly number[]) {
  if (col.length !== 22) throw new Error(`${name}: expected 22 chart rows, got ${col.length}`);
}

assert22("COL_C", COL_C);
assert22("COL_CSHARP", COL_CSHARP);
assert22("COL_D", COL_D);
assert22("COL_EB", COL_EB);
assert22("COL_E", COL_E);
assert22("COL_F", COL_F);
assert22("COL_FSHARP", COL_FSHARP);
assert22("COL_G", COL_G);
assert22("COL_AB", COL_AB);
assert22("COL_A", COL_A);
assert22("COL_BB", COL_BB);
assert22("COL_B", COL_B);
assert22("COL_BSHARP", COL_BSHARP);

/** Tanpura bundle key → chart column (22 Hz values, row 1 = Sa for that choice). */
export const SHRUTI22_CHART_HZ_BY_TANPURA_KEY: Record<string, readonly number[]> = {
  kattai_1: COL_C,
  kattai_1_5: COL_CSHARP,
  kattai_2: COL_D,
  kattai_2_5: COL_EB,
  kattai_3: COL_E,
  kattai_4: COL_F,
  kattai_4_5: COL_FSHARP,
  kattai_5: COL_G,
  kattai_5_5: COL_AB,
  kattai_6: COL_A,
  kattai_6_5: COL_BB,
  kattai_7: COL_B,
  kattai_7_5: COL_BSHARP,
};

const FALLBACK_KEY = "kattai_1";

export function shruti22ChartColumnHz(tanpuraKey: string): readonly number[] {
  return SHRUTI22_CHART_HZ_BY_TANPURA_KEY[tanpuraKey] ?? SHRUTI22_CHART_HZ_BY_TANPURA_KEY[FALLBACK_KEY]!;
}

/** Row 1 (Sa) Hz from the chart for setup / `shrutiHz`. */
export function nominalChartSaHz(tanpuraKey: string): number {
  const col = shruti22ChartColumnHz(tanpuraKey);
  return col[0]!;
}

/**
 * 22 anchor Hz for live pitch: chart column for `tanpuraKey`, scaled so row 1 matches `sessionSaHz`
 * (handles tiny float drift vs stored `shrutiHz`).
 */
export function shruti22AnchorsScaled(sessionSaHz: number, tanpuraKey: string): number[] {
  const col = shruti22ChartColumnHz(tanpuraKey);
  const base = col[0]!;
  if (!(sessionSaHz > 0) || !(base > 0)) return [...col];
  const s = sessionSaHz / base;
  return col.map((hz) => hz * s);
}

/** Printed chart column title (Western note + Saphet/Kali) for setup / live UI. */
export const CHART_COLUMN_TITLE_BY_TANPURA_KEY: Record<string, { western: string; tradition: string }> = {
  kattai_1: { western: "C", tradition: "Saphet 1" },
  kattai_1_5: { western: "C#", tradition: "Kali 1" },
  kattai_2: { western: "D", tradition: "Saphet 2" },
  kattai_2_5: { western: "E♭", tradition: "Kali 2" },
  kattai_3: { western: "E", tradition: "Saphet 3" },
  kattai_4: { western: "F", tradition: "Saphet 4" },
  kattai_4_5: { western: "F#", tradition: "Kali 3" },
  kattai_5: { western: "G", tradition: "Saphet 5" },
  kattai_5_5: { western: "A♭", tradition: "Kali 4" },
  kattai_6: { western: "A", tradition: "Saphet 6" },
  kattai_6_5: { western: "B♭", tradition: "Kali 5" },
  kattai_7: { western: "B", tradition: "Saphet 7" },
  kattai_7_5: { western: "B#", tradition: "Octave Sa" },
};

export function chartColumnTitle(tanpuraKey: string): string {
  const t =
    CHART_COLUMN_TITLE_BY_TANPURA_KEY[tanpuraKey] ?? CHART_COLUMN_TITLE_BY_TANPURA_KEY[FALLBACK_KEY]!;
  return `${t.western} (${t.tradition})`;
}

/** Chart Hz for shruti row 1–22 in the user’s column, scaled to session Sa. */
export function shruti22ChartHzForRow(
  sessionSaHz: number,
  tanpuraKey: string,
  index22: number,
): number {
  const anchors = shruti22AnchorsScaled(sessionSaHz, tanpuraKey);
  const k = Math.max(1, Math.min(22, Math.round(index22))) - 1;
  return anchors[k]!;
}
