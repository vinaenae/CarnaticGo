import { nicknameTrophyById } from "@/lib/shop-items";
import { cn } from "@/lib/utils";

export function ProfileNicknameChip({
  trophyId,
  className,
}: {
  trophyId: string | null | undefined;
  className?: string;
}) {
  const trophy = nicknameTrophyById(trophyId);
  if (!trophy) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200",
        className,
      )}
      title={trophy.label}
    >
      {trophy.label}
    </span>
  );
}
