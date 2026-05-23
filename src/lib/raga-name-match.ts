/**
 * Normalize rāga names for typed-answer matching.
 */
export function normalizeRagaKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export type RagaAnswer = {
  /** Canonical display name */
  name: string;
  /** Normalized keys that count as correct */
  accept: string[];
};

export function buildRagaAnswer(name: string, extraAliases: string[] = []): RagaAnswer {
  const accept = new Set<string>();
  accept.add(normalizeRagaKey(name));
  for (const a of extraAliases) {
    const k = normalizeRagaKey(a);
    if (k) accept.add(k);
  }
  return { name, accept: [...accept] };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length]!;
}

/** Max edit distance allowed for a near-miss typed rāga name. */
function maxTypoDistance(len: number): number {
  if (len < 6) return 0;
  if (len < 10) return 1;
  return Math.min(3, Math.max(2, Math.floor(len / 6)));
}

function isNearRagaKey(guess: string, target: string): boolean {
  if (guess === target) return true;
  if (guess.length < 4 || target.length < 4) return false;

  const dist = levenshtein(guess, target);
  const maxLen = Math.max(guess.length, target.length);
  if (dist <= maxTypoDistance(maxLen)) return true;

  // Incomplete typing (e.g. "Shankarabharan" for Shankarabharanam)
  if (target.startsWith(guess) && target.length - guess.length <= 3) return true;
  if (guess.startsWith(target) && guess.length - target.length <= 3) return true;

  return false;
}

export function ragaGuessMatches(guess: string, answer: RagaAnswer): boolean {
  const key = normalizeRagaKey(guess);
  if (!key) return false;
  if (answer.accept.includes(key)) return true;
  return answer.accept.some((accepted) => isNearRagaKey(key, accepted));
}
