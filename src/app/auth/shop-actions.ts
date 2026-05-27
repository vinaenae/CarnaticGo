"use server";

import { revalidatePath } from "next/cache";
import { fetchPracticeDayMs, fetchPracticeStreakEligible } from "@/app/auth/practice-sync-actions";
import { createClient } from "@/lib/supabase/server";
import {
  isStreakFreezeItemId,
  parseStreakFreezeInventoryTiers,
  PRACTICE_STREAK_MIN_MS,
  STREAK_FREEZE_TIERS,
  type NicknameTrophyId,
  type ProfileBadgeId,
  type ShopItemId,
  type StreakFreezeDays,
  shopItemById,
  streakFreezeTierByItemId,
} from "@/lib/shop-items";
import { localCalendarDayString } from "@/lib/user-streak";

export type PracticeStreakDayRow = {
  day: string;
  practiceMs: number;
  qualified: boolean;
};

export type ShopState = {
  quizPointsTotal: number;
  streakFreezeInventory: Record<StreakFreezeDays, number>;
  streakFreezeArmedDays: number;
  shrutiBoxOwned: boolean;
  profileBadge: string | null;
  pointsMultiplierUntil: string | null;
  nicknameTrophy: string | null;
  nicknameTrophiesOwned: string[];
  practiceStreakEligible: boolean;
  practiceStreakDays: PracticeStreakDayRow[];
};

export type ShopActionResult =
  | { ok: true; state: ShopState }
  | { ok: false; error: string };

const SHOP_SELECT =
  "quiz_points_total, shop_streak_freeze_inventory, shop_streak_freeze_inventory_tiers, shop_streak_freeze_armed, shop_streak_freeze_armed_days, shop_shruti_box_owned, shop_profile_badge, shop_points_multiplier_until, shop_nickname_trophy, shop_nickname_trophies_owned";

function rowToPartialState(row: {
  quiz_points_total: number | null;
  shop_streak_freeze_inventory?: number | null;
  shop_streak_freeze_inventory_tiers?: Record<string, number> | null;
  shop_streak_freeze_armed?: boolean | null;
  shop_streak_freeze_armed_days?: number | null;
  shop_shruti_box_owned?: boolean | null;
  shop_profile_badge?: string | null;
  shop_points_multiplier_until?: string | null;
  shop_nickname_trophy?: string | null;
  shop_nickname_trophies_owned?: string[] | null;
}): Omit<ShopState, "practiceStreakEligible" | "practiceStreakDays"> {
  let tiers = parseStreakFreezeInventoryTiers(row.shop_streak_freeze_inventory_tiers ?? undefined);
  const legacyInv = Math.max(0, row.shop_streak_freeze_inventory ?? 0);
  if (legacyInv > 0 && tiers[1] < legacyInv) {
    tiers = { ...tiers, 1: legacyInv };
  }

  let armedDays = Math.max(0, row.shop_streak_freeze_armed_days ?? 0);
  if (armedDays === 0 && row.shop_streak_freeze_armed) {
    armedDays = 1;
  }

  return {
    quizPointsTotal: Math.max(0, row.quiz_points_total ?? 0),
    streakFreezeInventory: tiers,
    streakFreezeArmedDays: armedDays,
    shrutiBoxOwned: Boolean(row.shop_shruti_box_owned),
    profileBadge: row.shop_profile_badge ?? null,
    pointsMultiplierUntil: row.shop_points_multiplier_until ?? null,
    nicknameTrophy: row.shop_nickname_trophy ?? null,
    nicknameTrophiesOwned: row.shop_nickname_trophies_owned ?? [],
  };
}

async function buildFullShopState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partial: Omit<ShopState, "practiceStreakEligible" | "practiceStreakDays">,
): Promise<ShopState> {
  const anchor = localCalendarDayString();
  const practiceDays = await fetchPracticeDayMs(anchor);
  const eligible = await fetchPracticeStreakEligible(anchor);

  return {
    ...partial,
    practiceStreakEligible: eligible,
    practiceStreakDays: practiceDays.map((d) => ({
      day: d.day,
      practiceMs: d.practiceMs,
      qualified: d.practiceMs >= PRACTICE_STREAK_MIN_MS,
    })),
  };
}

export async function getShopState(): Promise<ShopState | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select(SHOP_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return buildFullShopState(supabase, rowToPartialState(data));
}

async function fetchStateForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ShopState | null> {
  const { data } = await supabase.from("users").select(SHOP_SELECT).eq("id", userId).maybeSingle();
  if (!data) return null;
  return buildFullShopState(supabase, rowToPartialState(data));
}

function revalidateShopPaths() {
  revalidatePath("/shop");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
}

export async function purchaseShopItem(
  itemId: ShopItemId,
  optionId?: ProfileBadgeId | NicknameTrophyId,
): Promise<ShopActionResult> {
  const item = shopItemById(itemId);
  if (!item) return { ok: false, error: "Unknown item." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to use the shop." };

  const anchorDay = localCalendarDayString();

  const { data, error } = await supabase.rpc("purchase_shop_item", {
    p_item_id: itemId,
    p_badge_id: optionId ?? null,
    p_anchor_day: anchorDay,
  });

  if (!error && data && typeof data === "object") {
    const payload = data as Record<string, unknown>;
    if (payload.ok) {
      revalidateShopPaths();
      const state = await fetchStateForUser(supabase, user.id);
      if (state) return { ok: true, state };
    }
  }

  const rpcMissing =
    error?.message.includes("purchase_shop_item") ||
    error?.message.includes("shop_streak_freeze") ||
    error?.message.includes("shop_points_multiplier") ||
    error?.message.includes("shop_nickname") ||
    error?.code === "PGRST202";

  if (!rpcMissing && error) {
    const msg = error.message;
    if (msg.includes("not enough points")) return { ok: false, error: "Not enough points." };
    if (msg.includes("already owned")) return { ok: false, error: "You already own this." };
    if (msg.includes("already unlocked")) {
      return { ok: false, error: "Profile badge already unlocked." };
    }
    if (msg.includes("nickname trophy already owned")) {
      return { ok: false, error: "You already own this nickname trophy." };
    }
    if (msg.includes("practice streak requirement")) {
      return {
        ok: false,
        error:
          "Need 7 days in a row with 15+ minutes of practice. Finish a session while signed in, then refresh the shop.",
      };
    }
    if (msg.includes("maximum streak freeze inventory")) {
      return { ok: false, error: "You already have the maximum of this freeze tier (3)." };
    }
    return { ok: false, error: msg };
  }

  return purchaseShopItemFallback(supabase, user.id, itemId, optionId, anchorDay);
}

async function purchaseShopItemFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemId: ShopItemId,
  optionId?: ProfileBadgeId | NicknameTrophyId,
  anchorDay?: string,
): Promise<ShopActionResult> {
  const item = shopItemById(itemId)!;
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select(SHOP_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (readErr || !row) {
    return {
      ok: false,
      error: "Shop is not set up yet. Run supabase/apply_shop_extras.sql in the Supabase SQL Editor.",
    };
  }

  const state = rowToPartialState(row);
  if (state.quizPointsTotal < item.price) {
    return { ok: false, error: "Not enough points." };
  }

  const patch: Record<string, unknown> = {
    quiz_points_total: state.quizPointsTotal - item.price,
  };

  if (isStreakFreezeItemId(itemId)) {
    const tier = streakFreezeTierByItemId(itemId)!;
    const count = state.streakFreezeInventory[tier.days];
    if (count >= tier.maxInventory) {
      return { ok: false, error: `You can hold at most ${tier.maxInventory} of this freeze tier.` };
    }
    const nextTiers = {
      ...Object.fromEntries(
        STREAK_FREEZE_TIERS.map((t) => [String(t.days), state.streakFreezeInventory[t.days]]),
      ),
      [String(tier.days)]: count + 1,
    };
    patch.shop_streak_freeze_inventory_tiers = nextTiers;
  } else if (itemId === "shruti-box") {
    if (state.shrutiBoxOwned) return { ok: false, error: "You already own the shruti box." };
    patch.shop_shruti_box_owned = true;
  } else if (itemId === "profile-badge") {
    if (!optionId) return { ok: false, error: "Choose a badge style." };
    if (state.profileBadge) return { ok: false, error: "Profile badge already unlocked." };
    patch.shop_profile_badge = optionId;
  } else if (itemId === "points-multiplier") {
    patch.shop_points_multiplier_until = new Date(
      Date.now() + 30 * 60 * 1000,
    ).toISOString();
  } else if (itemId === "nickname-trophy") {
    if (!optionId) return { ok: false, error: "Choose a nickname trophy." };
    if (state.nicknameTrophiesOwned.includes(optionId)) {
      return { ok: false, error: "You already own this nickname trophy." };
    }
    const eligible = await fetchPracticeStreakEligible(anchorDay ?? localCalendarDayString());
    if (!eligible) {
      return {
        ok: false,
        error:
          "Need 7 days in a row with 15+ minutes of practice. Sync practice from the shop page first.",
      };
    }
    patch.shop_nickname_trophies_owned = [...state.nicknameTrophiesOwned, optionId];
    patch.shop_nickname_trophy = optionId;
  }

  const { error: updateErr } = await supabase.from("users").update(patch).eq("id", userId);
  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  revalidateShopPaths();
  const next = await fetchStateForUser(supabase, userId);
  if (!next) return { ok: false, error: "Purchase saved but could not refresh." };
  return { ok: true, state: next };
}

export async function armStreakFreeze(days: StreakFreezeDays): Promise<ShopActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { data, error } = await supabase.rpc("arm_streak_freeze", { p_days: days });

  if (!error && data && typeof data === "object" && (data as { ok?: boolean }).ok) {
    revalidateShopPaths();
    const state = await fetchStateForUser(supabase, user.id);
    if (state) return { ok: true, state };
  }

  const rpcMissing =
    error?.message.includes("arm_streak_freeze") || error?.code === "PGRST202";

  if (!rpcMissing && error) {
    if (error.message.includes("no streak freeze")) {
      return { ok: false, error: "Buy this freeze tier first." };
    }
    if (error.message.includes("already armed")) {
      return { ok: false, error: "A streak freeze is already armed." };
    }
    return { ok: false, error: error.message };
  }

  const state = await fetchStateForUser(supabase, user.id);
  if (!state) {
    return { ok: false, error: "Shop is not set up yet. Run supabase/apply_shop_extras.sql." };
  }
  if (state.streakFreezeInventory[days] < 1) {
    return { ok: false, error: "Buy this freeze tier first." };
  }
  if (state.streakFreezeArmedDays > 0) {
    return { ok: false, error: "A streak freeze is already armed." };
  }

  const nextTiers = {
    ...Object.fromEntries(
      STREAK_FREEZE_TIERS.map((t) => [String(t.days), state.streakFreezeInventory[t.days]]),
    ),
    [String(days)]: state.streakFreezeInventory[days] - 1,
  };

  const { error: updateErr } = await supabase
    .from("users")
    .update({
      shop_streak_freeze_inventory_tiers: nextTiers,
      shop_streak_freeze_armed_days: days,
      shop_streak_freeze_armed: false,
    })
    .eq("id", user.id);

  if (updateErr) return { ok: false, error: updateErr.message };
  revalidateShopPaths();
  const next = await fetchStateForUser(supabase, user.id);
  if (!next) return { ok: false, error: "Could not refresh." };
  return { ok: true, state: next };
}

export async function equipProfileBadge(
  badgeId: ProfileBadgeId,
): Promise<ShopActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { data, error } = await supabase.rpc("equip_profile_badge", {
    p_badge_id: badgeId,
  });

  if (!error && data && typeof data === "object" && (data as { ok?: boolean }).ok) {
    revalidateShopPaths();
    const state = await fetchStateForUser(supabase, user.id);
    if (state) return { ok: true, state };
  }

  const state = await fetchStateForUser(supabase, user.id);
  if (!state?.profileBadge) {
    return { ok: false, error: "Unlock a profile badge in the shop first." };
  }

  const { error: updateErr } = await supabase
    .from("users")
    .update({ shop_profile_badge: badgeId })
    .eq("id", user.id);

  if (updateErr) return { ok: false, error: updateErr.message };
  revalidateShopPaths();
  const next = await fetchStateForUser(supabase, user.id);
  if (!next) return { ok: false, error: "Could not refresh." };
  return { ok: true, state: next };
}

export async function equipNicknameTrophy(
  trophyId: NicknameTrophyId,
): Promise<ShopActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { data, error } = await supabase.rpc("equip_nickname_trophy", {
    p_trophy_id: trophyId,
  });

  if (!error && data && typeof data === "object" && (data as { ok?: boolean }).ok) {
    revalidateShopPaths();
    const state = await fetchStateForUser(supabase, user.id);
    if (state) return { ok: true, state };
  }

  const state = await fetchStateForUser(supabase, user.id);
  if (!state?.nicknameTrophiesOwned.includes(trophyId)) {
    return { ok: false, error: "Buy this nickname trophy first." };
  }

  const { error: updateErr } = await supabase
    .from("users")
    .update({ shop_nickname_trophy: trophyId })
    .eq("id", user.id);

  if (updateErr) return { ok: false, error: updateErr.message };
  revalidateShopPaths();
  const next = await fetchStateForUser(supabase, user.id);
  if (!next) return { ok: false, error: "Could not refresh." };
  return { ok: true, state: next };
}
