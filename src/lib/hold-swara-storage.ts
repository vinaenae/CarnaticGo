/** Best consecutive Sa hold (seconds) per shruti key — localStorage. */

const STORAGE_KEY = "ragify-hold-swara-best";

type HoldSwaraBestMap = Record<string, number>;

function readMap(): HoldSwaraBestMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as HoldSwaraBestMap;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function writeMap(map: HoldSwaraBestMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function readHoldSwaraBestSeconds(tanpuraKey: string): number {
  const sec = readMap()[tanpuraKey];
  return typeof sec === "number" && sec > 0 ? sec : 0;
}

export function writeHoldSwaraBestSeconds(tanpuraKey: string, seconds: number) {
  if (!(seconds > 0)) return;
  const map = readMap();
  const prev = map[tanpuraKey] ?? 0;
  if (seconds <= prev) return;
  map[tanpuraKey] = seconds;
  writeMap(map);
}
