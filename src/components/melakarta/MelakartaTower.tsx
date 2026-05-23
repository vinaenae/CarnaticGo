"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { MELAKARTA_72, type MelakartaRaga } from "@/lib/melakarta72";
import { cn } from "@/lib/utils";
import { MelakartaDetailPanel } from "@/components/melakarta/MelakartaDetailPanel";
import styles from "@/components/melakarta/MelakartaTower.module.css";

function brickColors(raga: MelakartaRaga): { face: string; top: string; side: string } {
  const hue = 38 + raga.chakra * 7 + (raga.num % 6) * 3;
  const lightness = 90 - (raga.num % 6) * 1.2;
  const chroma = 0.045 + (raga.chakra % 4) * 0.012;
  const face = `oklch(${lightness}% ${chroma} ${hue})`;
  const top = `oklch(${Math.min(lightness + 5, 96)}% ${chroma * 0.85} ${hue})`;
  const side = `oklch(${Math.max(lightness - 12, 58)}% ${chroma * 1.15} ${hue - 4})`;
  return { face, top, side };
}

function MelakartaBrick({
  raga,
  active,
  onSelect,
}: {
  raga: MelakartaRaga;
  active: boolean;
  onSelect: (raga: MelakartaRaga) => void;
}) {
  const colors = brickColors(raga);

  return (
    <button
      type="button"
      className={cn(styles.brick, active && styles.brickActive)}
      style={
        {
          "--brick-face": colors.face,
          "--brick-top": colors.top,
          "--brick-side": colors.side,
        } as CSSProperties
      }
      aria-label={`${raga.num}. ${raga.name} — ${raga.chakraName} chakra`}
      aria-pressed={active}
      onClick={() => onSelect(raga)}
    >
      <span className={styles.brickTop} aria-hidden />
      <span className={styles.brickSide} aria-hidden />
      <span className={styles.brickFace}>
        <span className={styles.brickNum}>{raga.num}</span>
      </span>
    </button>
  );
}

const DETAIL_PANEL_CLASS =
  "min-h-[min(42vh,420px)] shrink-0 border-t border-border lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:h-full lg:w-96 lg:min-w-96 lg:max-w-96 lg:border-l lg:border-t-0";

/** Tapered rows (bottom → top); widths sum to 72. */
const TAPER_ROW_WIDTHS = [12, 11, 10, 9, 8, 7, 6, 5, 4] as const;
const TOWER_BASE_WIDTH = TAPER_ROW_WIDTHS[0];

function buildTaperFloors(): MelakartaRaga[][] {
  const floors: MelakartaRaga[][] = [];
  let start = 0;
  for (const width of TAPER_ROW_WIDTHS) {
    floors.push(MELAKARTA_72.slice(start, start + width));
    start += width;
  }
  return floors;
}

export function MelakartaTower() {
  const [selected, setSelected] = useState<MelakartaRaga | null>(null);

  const floors = useMemo(() => buildTaperFloors(), []);
  const activeNum = selected?.num ?? null;

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1">
      <div
        className="relative flex min-h-0 min-w-0 items-center justify-center overflow-auto pb-10 pt-4 lg:col-start-1 lg:row-start-1 lg:overflow-hidden lg:pt-5"
        role="application"
        aria-label="72 melakarta tower — click a block for details"
      >
        <div
          className={styles.scene}
          style={{ "--tower-base-cols": TOWER_BASE_WIDTH } as CSSProperties}
        >
          <div className={styles.tower}>
            {floors.map((bricks, rowIndex) => (
              <div key={bricks[0]?.num ?? rowIndex} className={styles.floor}>
                {bricks.map((raga) => (
                  <MelakartaBrick
                    key={raga.num}
                    raga={raga}
                    active={activeNum === raga.num}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            ))}

            <div className={styles.capstone} aria-hidden>
              <span className={styles.capstoneNum}>72</span>
              <span className={styles.capstoneLabel}>melakartas</span>
            </div>
          </div>

          <div className={styles.ground} aria-hidden />
        </div>
      </div>

      <MelakartaDetailPanel
        raga={selected}
        className={DETAIL_PANEL_CLASS}
        onClose={selected ? () => setSelected(null) : undefined}
      />
    </div>
  );
}
