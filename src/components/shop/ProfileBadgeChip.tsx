import { profileBadgeById } from "@/lib/shop-items";
import { cn } from "@/lib/utils";

export function ProfileBadgeChip({
  badgeId,
  className,
}: {
  badgeId: string | null | undefined;
  className?: string;
}) {
  const badge = profileBadgeById(badgeId);
  if (!badge) return null;
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm leading-none",
        className,
      )}
      title={badge.label}
      aria-label={badge.label}
    >
      {badge.shortLabel}
    </span>
  );
}
