#!/usr/bin/env node
/** Run KritiSamhita tonic detector training (uses raga-classifier venv). */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const py =
  process.platform === "win32"
    ? path.join(root, "services", "raga-classifier", ".venv", "Scripts", "python.exe")
    : path.join(root, "services", "raga-classifier", ".venv", "bin", "python");
const script = path.join(root, "services", "tonic-detector", "train_tonic.py");
const dataset = path.join(root, "data", "kriti-samhita");

const child = spawn(
  py,
  [script, "--dataset-dir", dataset, "--epochs", "30", "--out-dir", path.join(root, "services", "tonic-detector", "checkpoints")],
  { stdio: "inherit", cwd: root, env: { ...process.env, PYTHONUTF8: "1" } },
);
child.on("exit", (code) => process.exit(code ?? 1));
