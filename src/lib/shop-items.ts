export type StreakFreezeDays = 1 | 2 | 4 | 7;

export type StreakFreezeItemId = `streak-freeze-${StreakFreezeDays}`;

export type ShopItemId =
  | StreakFreezeItemId
  | "shruti-box"
  | "profile-badge"
  | "points-multiplier"
  | "nickname-trophy";

export type ProfileBadgeId = "raga-star" | "tala-pulse" | "shruti-moon";

export type NicknameTrophyId = "tala-champion" | "shruti-hero";

export const SHOP_POINTS_MULTIPLIER = 1.5;
export const SHOP_POINTS_MULTIPLIER_MINUTES = 30;
export const PRACTICE_STREAK_DAYS = 7;
export const PRACTICE_STREAK_MIN_MS = 15 * 60 * 1000;

export const STREAK_FREEZE_TIERS: {
  days: StreakFreezeDays;
  itemId: StreakFreezeItemId;
  price: number;
  maxInventory: number;
  label: string;
}[] = [
  {
    days: 1,
    itemId: "streak-freeze-1",
    price: 120,
    maxInventory: 3,
    label: "1-day freeze",
  },
  {
    days: 2,
    itemId: "streak-freeze-2",
    price: 240,
    maxInventory: 3,
    label: "2-day freeze",
  },
  {
    days: 4,
    itemId: "streak-freeze-4",
    price: 520,
    maxInventory: 3,
    label: "4-day freeze",
  },
  {
    days: 7,
    itemId: "streak-freeze-7",
    price: 950,
    maxInventory: 3,
    label: "7-day freeze",
  },
];

export const STREAK_FREEZE_SHOP = {
  name: "Streak freeze",
  description:
    "Arm before you miss login days. On your next sign-in, up to that many consecutive missed days are forgiven so your streak continues.",
  icon: "snowflake" as const,
};

export const SHOP_ITEMS = [
  {
    id: "points-multiplier" as const,
    name: "Points boost",
    price: 140,
    description:
      "1.5× quiz points for the next 30 minutes (correct answers and streak bonuses). Buy again anytime to refresh the timer.",
    icon: "zap",
  },
  {
    id: "shruti-box" as const,
    name: "Shruti box",
    price: 350,
    description:
      "Unlock tanpura drone loops for every kattai on the Shop page — preview or loop while you practice.",
    icon: "music",
  },
  {
    id: "profile-badge" as const,
    name: "Profile badge",
    price: 180,
    description:
      "Show a badge next to your name on the leaderboard. Pick one of three Carnatic-themed badges.",
    icon: "award",
  },
  {
    id: "nickname-trophy" as const,
    name: "Nickname trophies",
    price: 220,
    description:
      "Unlock a leaderboard title after 7 days in a row with 15+ minutes of sing-with-tāla practice (while signed in).",
    icon: "trophy",
  },
] as const;

export const PROFILE_BADGES: {
  id: ProfileBadgeId;
  label: string;
  shortLabel: string;
}[] = [
  { id: "raga-star", label: "Rāga star", shortLabel: "✦" },
  { id: "tala-pulse", label: "Tāla pulse", shortLabel: "♩" },
  { id: "shruti-moon", label: "Shruti moon", shortLabel: "☽" },
];

export const NICKNAME_TROPHIES: {
  id: NicknameTrophyId;
  label: string;
}[] = [
  { id: "tala-champion", label: "Tala champion" },
  { id: "shruti-hero", label: "7-day shruti hero" },
];

export function streakFreezeTierByItemId(id: string) {
  return STREAK_FREEZE_TIERS.find((t) => t.itemId === id);
}

export function isStreakFreezeItemId(id: string): id is StreakFreezeItemId {
  return STREAK_FREEZE_TIERS.some((t) => t.itemId === id);
}

export function shopItemById(id: ShopItemId) {
  const tier = streakFreezeTierByItemId(id);
  if (tier) {
    return {
      id: tier.itemId,
      name: tier.label,
      price: tier.price,
      description: STREAK_FREEZE_SHOP.description,
      icon: STREAK_FREEZE_SHOP.icon,
    };
  }
  return SHOP_ITEMS.find((i) => i.id === id);
}

export function parseStreakFreezeInventoryTiers(
  raw: Record<string, number> | null | undefined,
): Record<StreakFreezeDays, number> {
  const out: Record<StreakFreezeDays, number> = { 1: 0, 2: 0, 4: 0, 7: 0 };
  if (!raw) return out;
  for (const tier of STREAK_FREEZE_TIERS) {
    const key = String(tier.days);
    const n = raw[key] ?? raw[tier.days as unknown as string];
    out[tier.days] = Math.max(0, Number(n) || 0);
  }
  return out;
}

export function profileBadgeById(id: string | null | undefined) {
  if (!id) return null;
  return PROFILE_BADGES.find((b) => b.id === id) ?? null;
}

export function nicknameTrophyById(id: string | null | undefined) {
  if (!id) return null;
  return NICKNAME_TROPHIES.find((t) => t.id === id) ?? null;
}

export function isPointsMultiplierActive(untilIso: string | null | undefined): boolean {
  if (!untilIso) return false;
  return new Date(untilIso).getTime() > Date.now();
}

export function formatMultiplierRemaining(untilIso: string | null | undefined): string | null {
  if (!untilIso) return null;
  const ms = new Date(untilIso).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min left`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
}
