import {
  formatSingTalaSessionDuration,
  singTalaSessionDisplayName,
  type SingTalaExportRangeDays,
  type SingTalaPastSession,
} from "@/lib/sing-tala-session-storage";

export type PlannerDayBlock = {
  title: string;
  durationMs: number;
  notes?: string;
};

export type PlannerDayEntry = {
  date: Date;
  dateKey: string;
  blocks: PlannerDayBlock[];
};

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sessionToBlock(session: SingTalaPastSession): PlannerDayBlock {
  return {
    title: singTalaSessionDisplayName(session),
    durationMs: session.durationMs,
    notes: session.notes,
  };
}

export function buildPlannerDays(
  sessions: SingTalaPastSession[],
  rangeDays: number,
  now: Date = new Date(),
): PlannerDayEntry[] {
  const byDay = new Map<string, SingTalaPastSession[]>();
  for (const s of sessions) {
    const d = new Date(s.endedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = localDateKey(d);
    const list = byDay.get(key) ?? [];
    list.push(s);
    byDay.set(key, list);
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime());
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const days: PlannerDayEntry[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const daySessions = byDay.get(key) ?? [];
    days.push({
      date: d,
      dateKey: key,
      blocks: daySessions.map(sessionToBlock),
    });
  }
  return days;
}

export function plannerRangeTitle(rangeDays: SingTalaExportRangeDays): string {
  if (rangeDays === 7) return "Weekly practice planner";
  if (rangeDays === 14) return "Two-week practice planner";
  return "Monthly practice planner";
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function parseNoteLines(notes: string | undefined): string[] {
  if (!notes?.trim()) return [];
  return notes
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const COLS = 7;
const PAD = 48;
const GAP = 14;
const HEADER_H = 88;
const CELL_H = 248;
const PAPER = "#faf6ef";
const INK = "#3d3429";
const MUTED = "#8a7f72";
const LINE = "#ddd4c7";
const ACCENT = "#9a6b45";

export async function downloadPracticePlannerImage(
  days: PlannerDayEntry[],
  rangeDays: SingTalaExportRangeDays,
): Promise<void> {
  if (typeof window === "undefined" || days.length === 0) return;

  const rows = Math.ceil(days.length / COLS);
  const width = 1120;
  const cellW = (width - PAD * 2 - GAP * (COLS - 1)) / COLS;
  const height = PAD + HEADER_H + rows * CELL_H + (rows - 1) * GAP + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = INK;
  ctx.font = "600 28px Georgia, 'Times New Roman', serif";
  ctx.fillText(plannerRangeTitle(rangeDays), PAD, PAD + 28);

  const start = days[0]?.date;
  const end = days[days.length - 1]?.date;
  const sub =
    start && end
      ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
      : "";
  ctx.fillStyle = MUTED;
  ctx.font = "400 15px system-ui, sans-serif";
  ctx.fillText(sub, PAD, PAD + 54);

  const gridTop = PAD + HEADER_H;

  for (let i = 0; i < days.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = PAD + col * (cellW + GAP);
    const y = gridTop + row * (CELL_H + GAP);
    const entry = days[i]!;

    ctx.fillStyle = "#fffdf8";
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, cellW, CELL_H, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = ACCENT;
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillText(formatDayHeader(entry.date), x + 12, y + 22);

    let contentY = y + 42;

    for (const block of entry.blocks) {
      ctx.fillStyle = INK;
      ctx.font = "600 12px system-ui, sans-serif";
      for (const line of wrapText(ctx, block.title, cellW - 24).slice(0, 2)) {
        ctx.fillText(line, x + 12, contentY);
        contentY += 16;
      }
      ctx.fillStyle = MUTED;
      ctx.font = "400 11px system-ui, sans-serif";
      const meta = formatSingTalaSessionDuration(block.durationMs);
      for (const line of wrapText(ctx, meta, cellW - 24).slice(0, 1)) {
        ctx.fillText(line, x + 12, contentY);
        contentY += 14;
      }
      contentY += 4;
    }

    const noteLines = entry.blocks.flatMap((block) => parseNoteLines(block.notes));
    const lineStart = Math.max(contentY, y + 78);
    const lineEnd = y + CELL_H - 12;

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    let noteRow = 0;
    for (let ly = lineStart; ly <= lineEnd; ly += 18, noteRow++) {
      ctx.beginPath();
      ctx.moveTo(x + 10, ly);
      ctx.lineTo(x + cellW - 10, ly);
      ctx.stroke();

      const note = noteLines[noteRow];
      if (note) {
        ctx.fillStyle = INK;
        ctx.font = "400 11px Georgia, 'Times New Roman', serif";
        ctx.fillText("•", x + 12, ly - 5);
        ctx.fillText(wrapText(ctx, note, cellW - 36)[0] ?? "", x + 22, ly - 5);
      }
    }
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return;

  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `practice-planner-${rangeDays}d-${stamp}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
