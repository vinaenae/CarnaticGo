"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildPlannerDays, downloadPracticePlannerImage } from "@/lib/sing-tala-planner-export";
import {
  filterSingTalaPastSessionsByDays,
  formatSingTalaSessionDuration,
  formatSingTalaSessionWhen,
  readSingTalaPastSessions,
  SING_TALA_EXPORT_RANGES,
  deleteSingTalaPastSession,
  singTalaSessionDisplayName,
  updateSingTalaPastSessionNotes,
  type SingTalaExportRangeDays,
  type SingTalaPastSession,
} from "@/lib/sing-tala-session-storage";
import styles from "@/components/dashboard/SingTalaPastSessions.module.css";

function SessionRow({
  session,
  editing,
  onWriteNotes,
  onDoneNotes,
  onDelete,
}: {
  session: SingTalaPastSession;
  editing: boolean;
  onWriteNotes: () => void;
  onDoneNotes: (notes: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(session.notes ?? "");

  useEffect(() => {
    if (editing) setDraft(session.notes ?? "");
  }, [editing, session.notes]);

  return (
    <li className={styles.item}>
      <div className={styles.itemMain}>
        <span className={styles.when}>{formatSingTalaSessionWhen(session.endedAt)}</span>
        <span className={styles.meta}>
          {singTalaSessionDisplayName(session)}
          {session.notes?.trim() && !editing ? (
            <span className={styles.notesSaved}> · Notes added</span>
          ) : null}
        </span>
        <span className={styles.duration}>
          {formatSingTalaSessionDuration(session.durationMs)}
        </span>
        {!editing ? (
          <div className={styles.itemActions}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={styles.actionBtn}
              onClick={onWriteNotes}
            >
              {session.notes?.trim() ? "Edit notes" : "Write notes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={styles.deleteBtn}
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className={styles.notesPanel}>
          <label className={styles.notesLabel}>
            <span className="sr-only">Practice session bullet notes</span>
            <textarea
              className={styles.notesInput}
              rows={5}
              autoFocus
              placeholder={"• Warm-up swaras\n• Varnam / kriti\n• Tāla practice"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <Button
            type="button"
            size="sm"
            className={styles.notesDoneBtn}
            onClick={() => onDoneNotes(draft)}
          >
            Done
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function SingTalaPastSessions({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState(() => readSingTalaPastSessions(userId));
  const [rangeDays, setRangeDays] = useState<SingTalaExportRangeDays>(7);
  const [exporting, setExporting] = useState(false);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setSessions(readSingTalaPastSessions(userId));
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const inRange = useMemo(() => {
    const filtered = filterSingTalaPastSessionsByDays(sessions, rangeDays);
    return [...filtered].sort(
      (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
    );
  }, [sessions, rangeDays]);

  const plannerDays = useMemo(
    () => buildPlannerDays(inRange, rangeDays),
    [inRange, rangeDays],
  );

  const onExport = async () => {
    if (inRange.length === 0) return;
    setExporting(true);
    try {
      await downloadPracticePlannerImage(plannerDays, rangeDays);
    } finally {
      setExporting(false);
    }
  };

  const saveNotes = (sessionId: string, notes: string) => {
    updateSingTalaPastSessionNotes(userId, sessionId, notes);
    setEditingNotesId(null);
    refresh();
  };

  const deleteSession = (sessionId: string) => {
    if (!window.confirm("Delete this practice session? It will not appear in exports.")) return;
    deleteSingTalaPastSession(userId, sessionId);
    setEditingNotesId((current) => (current === sessionId ? null : current));
    refresh();
  };

  if (sessions.length === 0) return null;

  return (
    <details className={styles.root}>
      <summary className={styles.summary}>
        <span>Practice planner</span>
        <span className={styles.summaryChevron} aria-hidden="true" />
      </summary>

      <div className={styles.toolbar}>
        <label className={styles.rangeLabel}>
          <span className="sr-only">Time range</span>
          <select
            className={styles.rangeSelect}
            value={rangeDays}
            onChange={(e) => {
              setRangeDays(Number(e.target.value) as SingTalaExportRangeDays);
              setEditingNotesId(null);
            }}
          >
            {SING_TALA_EXPORT_RANGES.map((r) => (
              <option key={r.days} value={r.days}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={inRange.length === 0 || exporting}
          onClick={() => void onExport()}
        >
          {exporting ? "Exporting…" : "Export"}
        </Button>
      </div>

      {inRange.length === 0 ? (
        <p className={styles.empty}>No saved sessions in this period.</p>
      ) : (
        <div className={styles.sessionScroll}>
          <ul className={styles.list}>
            {inRange.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                editing={editingNotesId === s.id}
                onWriteNotes={() => setEditingNotesId(s.id)}
                onDoneNotes={(notes) => saveNotes(s.id, notes)}
                onDelete={() => deleteSession(s.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
