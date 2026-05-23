import { formatSingTalaTimer, SING_TALA_ACTIVE_GOAL_MS } from "@/lib/sing-tala-points";
import { localCalendarDayString } from "@/lib/user-streak";

const STORAGE_KEY_PREFIX = "ragify-sing-tala-sessions";
const MAX_SESSIONS = 50;

export type SingTalaPastSession = {
  id: string;
  endedAt: string;
  durationMs: number;
  raga: string;
  shruti: string;
  title?: string;
  /** Planner bullet notes — one item per line. */
  notes?: string;
};

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function readAll(userId: string): SingTalaPastSession[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSingTalaPastSession);
  } catch {
    return [];
  }
}

function writeAll(userId: string, sessions: SingTalaPastSession[]) {
  if (typeof window === "undefined" || !userId) return;
  localStorage.setItem(storageKey(userId), JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
}

function isSingTalaPastSession(v: unknown): v is SingTalaPastSession {
  if (!v || typeof v !== "object") return false;
  const s = v as SingTalaPastSession;
  return (
    typeof s.id === "string" &&
    typeof s.endedAt === "string" &&
    typeof s.durationMs === "number" &&
    s.durationMs > 0 &&
    typeof s.raga === "string" &&
    typeof s.shruti === "string" &&
    (s.title === undefined || typeof s.title === "string") &&
    (s.notes === undefined || typeof s.notes === "string")
  );
}

export function singTalaSessionLocalDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA");
}

export function singTalaSessionsForLocalDay(
  sessions: SingTalaPastSession[],
  day: string = localCalendarDayString(),
): SingTalaPastSession[] {
  return sessions.filter((session) => singTalaSessionLocalDay(session.endedAt) === day);
}

export function totalSingTalaDurationMs(sessions: readonly SingTalaPastSession[]): number {
  return sessions.reduce((sum, session) => sum + session.durationMs, 0);
}

/** True when same-day sessions total at least 15 min (one long or several combined). */
export function qualifiesForSingTalaDailyBonus(
  sessions: SingTalaPastSession[],
  day: string = localCalendarDayString(),
): boolean {
  const daySessions = singTalaSessionsForLocalDay(sessions, day);
  return totalSingTalaDurationMs(daySessions) >= SING_TALA_ACTIVE_GOAL_MS;
}

export function readSingTalaPastSessions(userId: string): SingTalaPastSession[] {
  if (!userId) return [];
  return readAll(userId);
}

export function addSingTalaPastSession(
  userId: string,
  entry: Omit<SingTalaPastSession, "id" | "endedAt"> & { endedAt?: string },
): SingTalaPastSession | null {
  if (!userId) return null;
  const session: SingTalaPastSession = {
    id: crypto.randomUUID(),
    endedAt: entry.endedAt ?? new Date().toISOString(),
    durationMs: entry.durationMs,
    raga: entry.raga,
    shruti: entry.shruti,
  };
  const next = [session, ...readAll(userId)];
  writeAll(userId, next);
  return session;
}

export function getSingTalaPastSession(
  userId: string,
  sessionId: string,
): SingTalaPastSession | null {
  if (!userId) return null;
  return readAll(userId).find((s) => s.id === sessionId) ?? null;
}

export function updateSingTalaPastSessionTitle(
  userId: string,
  sessionId: string,
  title: string,
): boolean {
  if (!userId) return false;
  const trimmed = title.trim().slice(0, 120);
  const sessions = readAll(userId);
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return false;
  sessions[idx] = {
    ...sessions[idx]!,
    title: trimmed.length > 0 ? trimmed : undefined,
  };
  writeAll(userId, sessions);
  return true;
}

export function updateSingTalaPastSessionNotes(
  userId: string,
  sessionId: string,
  notes: string,
): boolean {
  if (!userId) return false;
  const trimmed = notes.trim().slice(0, 2000);
  const sessions = readAll(userId);
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return false;
  sessions[idx] = {
    ...sessions[idx]!,
    notes: trimmed.length > 0 ? trimmed : undefined,
  };
  writeAll(userId, sessions);
  return true;
}

export function deleteSingTalaPastSession(userId: string, sessionId: string): boolean {
  if (!userId) return false;
  const sessions = readAll(userId);
  const next = sessions.filter((s) => s.id !== sessionId);
  if (next.length === sessions.length) return false;
  writeAll(userId, next);
  return true;
}

export function singTalaSessionDisplayName(session: SingTalaPastSession): string {
  const named = session.title?.trim();
  if (named) return named;
  return "Practice session";
}

export function formatSingTalaSessionWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSingTalaSessionDuration(ms: number): string {
  return formatSingTalaTimer(ms);
}

export type SingTalaExportRangeDays = 7 | 14 | 30;

export const SING_TALA_EXPORT_RANGES: readonly {
  days: SingTalaExportRangeDays;
  label: string;
}[] = [
  { days: 7, label: "Past 7 days" },
  { days: 14, label: "Past 2 weeks" },
  { days: 30, label: "Past month" },
] as const;

export function filterSingTalaPastSessionsByDays(
  sessions: SingTalaPastSession[],
  days: number,
  nowMs: number = Date.now(),
): SingTalaPastSession[] {
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
  return sessions.filter((s) => {
    const t = new Date(s.endedAt).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });
}
