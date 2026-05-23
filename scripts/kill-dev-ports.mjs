/**
 * Free ports 8002–8004 (python APIs) before npm run dev.
 * Avoids Windows EADDRINUSE when a previous dev session left Python servers running.
 */
import { execSync } from "node:child_process";

const PORTS = [8002, 8003, 8004];

function freePort(port) {
  if (process.platform !== "win32") return;
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split("\n")) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`[kill-dev-ports] Freed :${port} (pid ${pid})`);
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* nothing listening */
  }
}

for (const port of PORTS) freePort(port);
