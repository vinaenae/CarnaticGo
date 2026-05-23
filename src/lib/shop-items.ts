export type ShopItemId = "streak-freeze" | "shruti-box" | "profile-badge";

export type ProfileBadgeId = "raga-star" | "tala-pulse" | "shruti-moon";

export const SHOP_ITEMS = [
  {
    id: "streak-freeze" as const,
    name: "Streak freeze",
    price: 120,
    description:
      "Arm before you miss a login day. The next time your streak would break, one missed day is forgiven.",
    icon: "snowflake",
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

export const MAX_STREAK_FREEZE_INVENTORY = 5;

export function shopItemById(id: ShopItemId) {
  return SHOP_ITEMS.find((i) => i.id === id);
}

export function profileBadgeById(id: string | null | undefined) {
  if (!id) return null;
  return PROFILE_BADGES.find((b) => b.id === id) ?? null;
}
