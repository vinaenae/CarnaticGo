/**
 * Start shruti-fft FastAPI (creates .venv + installs deps on first run).
 * Used by `npm run dev`.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svc = join(root, "services", "shruti-fft");
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
    console.log("[shruti-fft] Creating virtualenv…");
    await run(py, ["-m", "venv", ".venv"], { cwd: svc });
  }
  const pip = existsSync(pyExe) ? pyExe : py;
  console.log("[shruti-fft] Installing requirements (if needed)…");
  await run(pip, ["-m", "pip", "install", "-q", "-r", "requirements.txt"], { cwd: svc });
}

await ensureDeps();
const python = existsSync(pyExe) ? pyExe : py;
console.log("[shruti-fft] API http://127.0.0.1:8002");
const uvicorn = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8002"],
  { cwd: svc, stdio: "inherit", shell: isWin },
);
uvicorn.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => uvicorn.kill());
process.on("SIGTERM", () => uvicorn.kill());
