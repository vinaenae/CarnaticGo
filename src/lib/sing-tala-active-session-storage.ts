const STORAGE_KEY = "ragify-sing-tala-active";

type ActiveSingTalaSession = {
  sessionId: string;
  elapsedMs: number;
  started: boolean;
};

function readRaw(): ActiveSingTalaSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as ActiveSingTalaSession;
    if (
      v &&
      typeof v.sessionId === "string" &&
      typeof v.elapsedMs === "number" &&
      v.elapsedMs >= 0
    ) {
      return {
        sessionId: v.sessionId,
        elapsedMs: v.elapsedMs,
        started: v.started === true,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeRaw(row: ActiveSingTalaSession) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(row));
}

export function readSingTalaActiveElapsedMs(sessionId: string): number {
  const row = readRaw();
  if (!row || row.sessionId !== sessionId) return 0;
  return row.elapsedMs;
}

export function hasSingTalaActiveSession(sessionId: string): boolean {
  const row = readRaw();
  return row?.sessionId === sessionId && row.started;
}

export function markSingTalaSessionStarted(sessionId: string) {
  const row = readRaw();
  const elapsedMs =
    row?.sessionId === sessionId ? row.elapsedMs : readSingTalaActiveElapsedMs(sessionId);
  writeRaw({ sessionId, elapsedMs, started: true });
}

export function writeSingTalaActiveElapsedMs(sessionId: string, elapsedMs: number) {
  const row = readRaw();
  const started = row?.sessionId === sessionId && row.started;
  writeRaw({
    sessionId,
    elapsedMs: Math.max(0, elapsedMs),
    started,
  });
}

export function clearSingTalaActiveSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
