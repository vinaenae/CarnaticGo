/**
 * Synthetic mridangam + tabla practice loops for quiz recording mix-in.
 * Run: npm run generate:accompaniment
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACCOMPANIMENT_LOOPS } from "../src/lib/audio/accompaniment-manifest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "assets", "accompaniment");
const SAMPLE_RATE = 44100;
const DURATION_SEC = 12;

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

function toPcm(buf: Float64Array): Int16Array {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]!));
  const scale = peak > 0 ? 0.72 / peak : 1;
  const fade = Math.min(4096, Math.floor(buf.length / 4));
  const out = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    let g = 1;
    if (i < fade) g = i / fade;
    else if (i >= buf.length - fade) g = (buf.length - 1 - i) / fade;
    const v = buf[i]! * scale * g * 32767;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v)));
  }
  return out;
}

/** Damped strike — rough drum resonance. */
function strike(
  buf: Float64Array,
  startSample: number,
  freqHz: number,
  decaySec: number,
  amp: number,
  noiseAmt = 0,
) {
  const sr = SAMPLE_RATE;
  const len = Math.min(buf.length - startSample, Math.ceil(decaySec * sr));
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.exp(-t / decaySec);
    const tone = Math.sin(2 * Math.PI * freqHz * t);
    const noise = noiseAmt > 0 ? (Math.random() * 2 - 1) * noiseAmt : 0;
    const idx = startSample + i;
    if (idx >= 0 && idx < buf.length) buf[idx]! += amp * env * (tone + noise);
  }
}

/** 8-beat slow adi (≈84 BPM) — bass mridangam pattern. */
function synthesizeMridangam(): Int16Array {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const buf = new Float64Array(n);
  const bpm = 84;
  const beatSec = 60 / bpm;
  const cycleBeats = 8;
  const cycleSamples = Math.round(beatSec * cycleBeats * SAMPLE_RATE);

  for (let pos = 0; pos < n; pos += cycleSamples) {
    for (let b = 0; b < cycleBeats; b++) {
      const start = pos + Math.round(b * beatSec * SAMPLE_RATE);
      const strong = b === 0 || b === 4;
      strike(buf, start, strong ? 98 : 118, 0.11, strong ? 0.55 : 0.38, 0.12);
      if (strong) strike(buf, start, 52, 0.18, 0.22, 0.05);
    }
  }
  return toPcm(buf);
}

/** Teen taal (16 beats) simplified — tabla-like high/low alternation. */
function synthesizeTabla(): Int16Array {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const buf = new Float64Array(n);
  const bpm = 76;
  const beatSec = 60 / bpm;
  const cycleBeats = 16;

  for (let pos = 0; pos < n; ) {
    for (let b = 0; b < cycleBeats; b++) {
      const start = pos + Math.round(b * beatSec * SAMPLE_RATE);
      const sam = b === 0 || b === 8;
      const tin = b % 2 === 1;
      if (sam) {
        strike(buf, start, 185, 0.07, 0.42, 0.18);
        strike(buf, start, 95, 0.12, 0.28, 0.08);
      } else if (tin) {
        strike(buf, start, 420, 0.04, 0.26, 0.22);
      } else {
        strike(buf, start, 240, 0.06, 0.3, 0.15);
      }
    }
    pos += Math.round(beatSec * cycleBeats * SAMPLE_RATE);
  }
  return toPcm(buf);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const writers: Record<string, () => Int16Array> = {
    "mridangam-adi-slow.wav": synthesizeMridangam,
    "tabla-tintal-slow.wav": synthesizeTabla,
  };
  for (const entry of ACCOMPANIMENT_LOOPS) {
    const fn = writers[entry.file];
    if (!fn) throw new Error(`No synthesizer for ${entry.file}`);
    const outPath = path.join(OUT_DIR, entry.file);
    writeWav16Mono(outPath, fn(), SAMPLE_RATE);
    console.log("Wrote", entry.file);
  }
  console.log("Done:", OUT_DIR);
}

main();
