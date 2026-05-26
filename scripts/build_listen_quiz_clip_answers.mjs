#!/usr/bin/env node
/** Regenerate public/assets/raga-guess/clip-answers.json from manifest + ragas. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "public/assets/raga-guess/manifest.json");
const ragasPath = path.join(root, "public/assets/raga-guess/ragas.json");
const outPath = path.join(root, "public/assets/raga-guess/clip-answers.json");

function clipSongSlug(url) {
  const file = url.split("/").pop() ?? "";
  return file.replace(/^kriti-[a-z0-9#]+-/i, "").replace(/\.wav$/i, "");
}

function titleFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const ragasFile = JSON.parse(fs.readFileSync(ragasPath, "utf8"));
const ragasById = Object.fromEntries((ragasFile.ragas ?? []).map((r) => [r.id, r]));

let existing = {};
if (fs.existsSync(outPath)) {
  existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
}

const songIndex = new Map();
for (const [ragaId, urls] of Object.entries(manifest)) {
  for (const url of urls) {
    const slug = clipSongSlug(url);
    const list = songIndex.get(slug) ?? [];
    list.push({ ragaId, url });
    songIndex.set(slug, list);
  }
}

const out = { ...existing };

for (const [ragaId, urls] of Object.entries(manifest)) {
  const raga = ragasById[ragaId];
  const ragaName = raga?.name ?? ragaId;
  for (const url of urls) {
    const slug = clipSongSlug(url);
    const variants = songIndex.get(slug) ?? [];
    const crossShrutiAliases = [];
    for (const v of variants) {
      if (v.ragaId === ragaId) continue;
      const other = ragasById[v.ragaId];
      if (other) {
        crossShrutiAliases.push(other.name, ...other.aliases);
      }
    }

    const prev = out[url] ?? {};
    const mergedAliases = [
      ...(prev.aliases ?? []),
      ...crossShrutiAliases,
      ...(raga?.aliases ?? []),
    ];
    const uniqueAliases = [...new Set(mergedAliases.map((a) => a.trim()).filter(Boolean))].filter(
      (a) => a.toLowerCase() !== ragaName.toLowerCase(),
    );

    out[url] = {
      song: prev.song ?? titleFromSlug(slug),
      raga: prev.raga ?? ragaName,
      aliases: uniqueAliases,
    };
  }
}

fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
console.log(`Wrote ${Object.keys(out).length} clip answers to ${outPath}`);
