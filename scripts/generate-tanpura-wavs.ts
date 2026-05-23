/**
 * Builds mono 16-bit PCM WAV drones (Sa + Pa at perfect fifth) for each entry in
 * `src/lib/audio/tanpura-manifest.ts`. Run: `npm run generate:tanpura`
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TANPURA_SAMPLE_MANIFEST } from "../src/lib/audio/tanpura-manifest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "assets", "tanpura");

const SAMPLE_RATE = 44100;
const DURATION_SEC = 12;
/** Pa above Sa (simple tanpura colour). */
const PA_RATIO = 1.5;

/** Softer Sa + quieter Pa + gentle one-pole low-pass (easier on ears; pitch unchanged). */
function synthesizeDrone(saHz: number): Int16Array {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const paHz = saHz * PA_RATIO;
  const buf = new Float64Array(n);
  let lp = 0;
  const lpCoef = 0.08;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const raw =
      0.68 * Math.sin(2 * Math.PI * saHz * t) + 0.26 * Math.sin(2 * Math.PI * paHz * t);
    lp += lpCoef * (raw - lp);
    buf[i] = lp;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const scale = peak > 0 ? 0.68 / peak : 1;
  const fade = Math.min(6144, Math.floor(n / 3));
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    let g = 1;
    if (i < fade) g = i / fade;
    else if (i >= n - fade) g = (n - 1 - i) / fade;
    const v = buf[i] * scale * g * 32767;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v)));
  }
  return out;
}

function writeWav16Mono(filePath: string, pcm: Int16Array, sampleRate: number) {
  const dataBytes = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  let o = 0;
  const w = (s: string) => {
    buffer.write(s, o);
    o += s.length;
  };
  const u32 = (n: number) => {
    buffer.writeUInt32LE(n, o);
    o += 4;
  };
  const u16 = (n: number) => {
    buffer.writeUInt16LE(n, o);
    o += 2;
  };

  w("RIFF");
  u32(36 + dataBytes);
  w("WAVE");
  w("fmt ");
  u32(16);
  u16(1);
  u16(1);
  u32(sampleRate);
  u32(sampleRate * 2);
  u16(2);
  u16(16);
  w("data");
  u32(dataBytes);
  for (let i = 0; i < pcm.length; i++) {
    buffer.writeInt16LE(pcm[i]!, o);
    o += 2;
  }
  fs.writeFileSync(filePath, buffer);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const e of TANPURA_SAMPLE_MANIFEST) {
    const pcm = synthesizeDrone(e.nominalSaHz);
    const outPath = path.join(OUT_DIR, e.file);
    writeWav16Mono(outPath, pcm, SAMPLE_RATE);
    console.log("Wrote", e.file, `Sa≈${e.nominalSaHz.toFixed(2)} Hz`);
  }
  console.log("Done:", TANPURA_SAMPLE_MANIFEST.length, "files in", OUT_DIR);
}

main();
