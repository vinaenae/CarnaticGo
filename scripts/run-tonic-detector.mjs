/**
 * Start tonic-detector FastAPI (KritiSamhita shruti model). Port 8004.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svc = join(root, "services", "tonic-detector");
const isWin = process.platform === "win32";
const venvDir = join(svc, ".venv");
const pyExe = isWin ? join(venvDir, "Scripts", "python.exe") : join(venvDir, "bin", "python");
const py = existsSync(pyExe) ? pyExe : isWin ? "python" : "python3";

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: opts.cwd ?? svc, shell: isWin, ...opts });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    child.on("error", reject);
  });
}

async function ensureDeps() {
  if (!existsSync(venvDir)) {
    console.log("[tonic] Creating virtualenv…");
    await run(py, ["-m", "venv", ".venv"], { cwd: svc });
  }
  const pip = existsSync(pyExe) ? pyExe : py;
  console.log("[tonic] Installing requirements (first run may take a few minutes)…");
  await run(pip, ["-m", "pip", "install", "-q", "--upgrade", "pip", "wheel"], { cwd: svc });
  await run(pip, ["-m", "pip", "install", "-q", "-r", "requirements.txt"], { cwd: svc });
}

await ensureDeps();
const python = existsSync(pyExe) ? pyExe : py;
console.log("[tonic] Tonic detector API http://127.0.0.1:8004");
const uvicorn = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8004"],
  { cwd: svc, stdio: "inherit", shell: isWin, env: { ...process.env, TONIC_DETECTOR_WARMUP: "1" } },
);
uvicorn.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => uvicorn.kill());
process.on("SIGTERM", () => uvicorn.kill());
