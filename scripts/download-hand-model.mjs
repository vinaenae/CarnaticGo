import { mkdirSync, writeFileSync, createWriteStream } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public/models/hand");
const outPath = join(outDir, "rigged-hand.glb");
const url =
  "https://raw.githubusercontent.com/WonderlandEngine/hand-poser/main/r_hand.glb";

mkdirSync(outDir, { recursive: true });
const res = await fetch(url);
if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
if (res.body) {
  await pipeline(Readable.fromWeb(res.body), createWriteStream(outPath));
} else {
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
}
console.log("Wrote", outPath);
