/**
 * Writes services/shruti-fft/data/raga_swara_notes.json from scale-quiz overrides.
 * Run: node scripts/generate-raga-swara-notes.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Must match src/lib/carnatic-scale-synth.ts TOKEN_HZ */
const TOKEN_HZ = {
  S: 240,
  "\u1E62": 480,
  "R\u2081": 254,
  "R\u2082": 269,
  "R\u2083": 285,
  "G\u2081": 269,
  "G\u2082": 285,
  "G\u2083": 302,
  "M\u2081": 320,
  "M\u2082": 338.5,
  P: 358.5,
  "D\u2081": 380,
  "D\u2082": 402,
  "D\u2083": 426,
  "N\u2081": 402,
  "N\u2082": 426,
  "N\u2083": 451,
};

const SUB = { 1: "\u2081", 2: "\u2082", 3: "\u2083" };

function canon(raw) {
  let s = raw.trim();
  if (s === "\u1E62" || s === "\u015A") return "\u1E62";
  if (s.length === 1) {
    const L = s[0].toUpperCase();
    if (L === "S") return "S";
    if (L === "P") return "P";
  }
  const letter = s[0]?.toUpperCase() ?? "";
  let rest = s.slice(1).replace(/[123]/g, (d) => SUB[d] ?? d);
  const key = letter + rest;
  if (TOKEN_HZ[key] != null) return key;
  return null;
}

function tokensFromLine(line) {
  return line
    .split(/[\s,]+/u)
    .map((p) => canon(p.trim()))
    .filter(Boolean);
}

const text = readFileSync(join(root, "src/lib/scale-quiz-scale-overrides.ts"), "utf8");
const blockRe = /^\s+(\w+):\s*\{[\s\S]*?arohanam:\s*"([^"]+)"[\s\S]*?avarohanam:\s*"([^"]+)"/gm;
const ragas = [];
let m;
while ((m = blockRe.exec(text)) !== null) {
  const id = m[1];
  const seen = new Set();
  const swaras = [];
  for (const t of [...tokensFromLine(m[2]), ...tokensFromLine(m[3])]) {
    if (seen.has(t)) continue;
    seen.add(t);
    swaras.push({ token: t, hz: TOKEN_HZ[t] });
  }
  swaras.sort((a, b) => a.hz - b.hz);
  if (swaras.length) ragas.push({ id, name: id, swaras });
}

const outDir = join(root, "services/shruti-fft/data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "raga_swara_notes.json");
writeFileSync(outPath, JSON.stringify({ ragas, chartHz: TOKEN_HZ }, null, 2), "utf8");
console.log(`Wrote ${ragas.length} ragas → ${outPath}`);
