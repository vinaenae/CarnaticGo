export const PRACTICE_SESSION_MODES = [
  { id: "warmup", label: "Warmup for your song" },
  { id: "tala", label: "Tala simulation" },
  { id: "hold-swara", label: "Hold the swara" },
] as const;

export type PracticeModeId = (typeof PRACTICE_SESSION_MODES)[number]["id"];

/** Query flag: guided Practice session flow (Start → Hold → Warmup → Ready to sing). */
export const PRACTICE_SESSION_FLOW = "session";

export const PRACTICE_SESSION_SECTION_LABEL = "Practice session";

export const START_PRACTICE_SESSION = {
  id: "start-session",
  label: "Start",
  href: `/practice/new?mode=hold-swara&flow=${PRACTICE_SESSION_FLOW}`,
} as const;

/** Practice dropdown — optional grouped sections (empty; extras hold standalone tools). */
export const PRACTICE_NAV_CATEGORIES = [] as const;

export const PRACTICE_NAV_ITEMS = [START_PRACTICE_SESSION] as const;

export type PracticeNavItemId = (typeof PRACTICE_NAV_ITEMS)[number]["id"];

export function isPracticeModeId(value: string): value is PracticeModeId {
  return PRACTICE_SESSION_MODES.some((m) => m.id === value);
}

export function isPracticeNavItemId(value: string): value is PracticeNavItemId {
  return PRACTICE_NAV_ITEMS.some((m) => m.id === value);
}

export function isPracticeSessionFlow(flowParam: string | null): boolean {
  return flowParam === PRACTICE_SESSION_FLOW;
}

export function practiceNewHref(mode: PracticeModeId, flow?: typeof PRACTICE_SESSION_FLOW) {
  const q = new URLSearchParams({ mode });
  if (flow) q.set("flow", flow);
  return `/practice/new?${q.toString()}`;
}

export function practiceLiveHref(
  sessionId: string,
  mode: PracticeModeId,
  opts?: { flow?: typeof PRACTICE_SESSION_FLOW; view?: string; shruti?: string; raga?: string },
) {
  const q = new URLSearchParams({ mode });
  if (opts?.flow) q.set("flow", opts.flow);
  if (opts?.view) q.set("view", opts.view);
  if (opts?.shruti) q.set("shruti", opts.shruti);
  if (opts?.raga) q.set("raga", opts.raga);
  return `/practice/${sessionId}/live?${q.toString()}`;
}

export function isPracticePath(path: string) {
  if (path.startsWith("/practice/tanpura-match")) return false;
  return path === "/practice/new" || path.startsWith("/practice/");
}

export function activePracticeNavItem(
  pathname: string,
  modeParam: string | null,
  flowParam: string | null,
): PracticeNavItemId | null {
  if (!pathname.startsWith("/practice")) return null;
  if (!isPracticeSessionFlow(flowParam)) return null;

  if (
    modeParam === "hold-swara" ||
    modeParam === "warmup" ||
    modeParam === "tala"
  ) {
    return "start-session";
  }

  return null;
}

/** @deprecated Use PRACTICE_SESSION_MODES */
export const PRACTICE_MODES = PRACTICE_SESSION_MODES;
