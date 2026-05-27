"use client";

import type { ReactNode } from "react";
import type { MelakartaRaga } from "@/lib/melakarta72";
import { melakartaGroup, melakartaMeans } from "@/lib/melakarta-raga-meanings";
import { melakartaRagaDetail, type MelakartaRagaDetail } from "@/lib/melakarta-raga-info";
import { melakartaSwaraScale } from "@/lib/melakarta-swaras";
import { cn } from "@/lib/utils";

type MelakartaDetailPanelProps = {
  raga: MelakartaRaga | null;
  className?: string;
  onClose?: () => void;
};

export function MelakartaDetailPanel({ raga, className, onClose }: MelakartaDetailPanelProps) {
  if (!raga) {
    return (
      <aside
        className={cn(
          "flex h-full flex-col justify-center rounded-xl border border-dashed border-border bg-card/50 p-6 text-center",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">Click a block for details.</p>
      </aside>
    );
  }

  const detail = melakartaRagaDetail(raga);
  const scale = melakartaSwaraScale(raga.num);
  const means = melakartaMeans(raga.num);
  const group = melakartaGroup(raga.num);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Melakarta {raga.num} · {raga.chakraName} chakra
          </p>
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {raga.name}
          </h2>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-primary/8 hover:text-foreground"
            aria-label="Close detail panel"
          >
            ✕
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <DetailSection title="Scale" hint={scale.madhyama}>
          <p className="font-mono text-xs text-foreground">
            <span className="text-muted-foreground">Up </span>
            {scale.arohanam}
          </p>
          <p className="font-mono text-xs text-foreground">
            <span className="text-muted-foreground">Down </span>
            {scale.avarohanam}
          </p>
        </DetailSection>

        <DetailSection title="Feeling">
          <p className="text-sm text-foreground">{detail.mood}</p>
        </DetailSection>

        <DetailSection title="This melakarta" hint="Name meaning and swara family for this raga">
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Means </span>
            {means}
          </p>
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Group </span>
            {group}
          </p>
          <p className="text-xs text-muted-foreground">
            Parent of many janya rāgas · {raga.chakraName} chakra group
          </p>
        </DetailSection>

        <CompositionsSection compositions={detail.compositions} />
      </div>
    </aside>
  );
}

function DetailSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {hint ? (
        <p className="mt-0.5 text-[10px] text-muted-foreground/80">{hint}</p>
      ) : null}
      <div className="mt-1">{children}</div>
    </section>
  );
}

function CompositionsSection({
  compositions,
}: {
  compositions: MelakartaRagaDetail["compositions"];
}) {
  return (
    <DetailSection title="Famous pieces" hint="Often sung in this raga">
      <ul className="space-y-1">
        {compositions.map((c) => (
          <li key={`${c.title}-${c.composer ?? ""}`} className="text-sm text-foreground">
            {c.title}
            {c.composer ? (
              <span className="text-muted-foreground"> · {c.composer}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}
