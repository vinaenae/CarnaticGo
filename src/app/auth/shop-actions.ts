"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_STREAK_FREEZE_INVENTORY,
  type ProfileBadgeId,
  type ShopItemId,
  shopItemById,
} from "@/lib/shop-items";

export type ShopState = {
  quizPointsTotal: number;
  streakFreezeInventory: number;
  streakFreezeArmed: boolean;
  shrutiBoxOwned: boolean;
  profileBadge: string | null;
};

export type ShopActionResult =
  | { ok: true; state: ShopState }
  | { ok: false; error: string };

const SHOP_SELECT =
  "quiz_points_total, shop_streak_freeze_inventory, shop_streak_freeze_armed, shop_shruti_box_owned, shop_profile_badge";

function rowToState(row: {
  quiz_points_total: number | null;
  shop_streak_freeze_inventory?: number | null;
  shop_streak_freeze_armed?: boolean | null;
  shop_shruti_box_owned?: boolean | null;
  shop_profile_badge?: string | null;
}): ShopState {
  return {
    quizPointsTotal: Math.max(0, row.quiz_points_total ?? 0),
    streakFreezeInventory: Math.max(0, row.shop_streak_freeze_inventory ?? 0),
    streakFreezeArmed: Boolean(row.shop_streak_freeze_armed),
    shrutiBoxOwned: Boolean(row.shop_shruti_box_owned),
    profileBadge: row.shop_profile_badge ?? null,
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
  return rowToState(data);
}

async function fetchStateForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ShopState | null> {
  const { data } = await supabase.from("users").select(SHOP_SELECT).eq("id", userId).maybeSingle();
  if (!data) return null;
  return rowToState(data);
}

function revalidateShopPaths() {
  revalidatePath("/shop");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
}

export async function purchaseShopItem(
  itemId: ShopItemId,
  badgeId?: ProfileBadgeId,
): Promise<ShopActionResult> {
  const item = shopItemById(itemId);
  if (!item) return { ok: false, error: "Unknown item." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to use the shop." };

  const { data, error } = await supabase.rpc("purchase_shop_item", {
    p_item_id: itemId,
    p_badge_id: badgeId ?? null,
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
    error?.code === "PGRST202";

  if (!rpcMissing && error) {
    const msg = error.message;
    if (msg.includes("not enough points")) return { ok: false, error: "Not enough points." };
    if (msg.includes("already owned")) return { ok: false, error: "You already own this." };
    if (msg.includes("already unlocked")) {
      return { ok: false, error: "Profile badge already unlocked." };
    }
    if (msg.includes("maximum streak")) {
      return { ok: false, error: `You can hold at most ${MAX_STREAK_FREEZE_INVENTORY} streak freezes.` };
    }
    return { ok: false, error: msg };
  }

  return purchaseShopItemFallback(supabase, user.id, itemId, badgeId);
}

async function purchaseShopItemFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemId: ShopItemId,
  badgeId?: ProfileBadgeId,
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
      error: "Shop is not set up yet. Run supabase/apply_shop.sql in the Supabase SQL Editor.",
    };
  }

  const state = rowToState(row);
  if (state.quizPointsTotal < item.price) {
    return { ok: false, error: "Not enough points." };
  }

  const patch: Record<string, unknown> = {
    quiz_points_total: state.quizPointsTotal - item.price,
  };

  if (itemId === "streak-freeze") {
    if (state.streakFreezeInventory >= MAX_STREAK_FREEZE_INVENTORY) {
      return { ok: false, error: `You can hold at most ${MAX_STREAK_FREEZE_INVENTORY} streak freezes.` };
    }
    patch.shop_streak_freeze_inventory = state.streakFreezeInventory + 1;
  } else if (itemId === "shruti-box") {
    if (state.shrutiBoxOwned) return { ok: false, error: "You already own the shruti box." };
    patch.shop_shruti_box_owned = true;
  } else if (itemId === "profile-badge") {
    if (!badgeId) return { ok: false, error: "Choose a badge style." };
    if (state.profileBadge) return { ok: false, error: "Profile badge already unlocked." };
    patch.shop_profile_badge = badgeId;
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

export async function armStreakFreeze(): Promise<ShopActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { data, error } = await supabase.rpc("arm_streak_freeze");

  if (!error && data && typeof data === "object" && (data as { ok?: boolean }).ok) {
    revalidateShopPaths();
    const state = await fetchStateForUser(supabase, user.id);
    if (state) return { ok: true, state };
  }

  const rpcMissing =
    error?.message.includes("arm_streak_freeze") || error?.code === "PGRST202";

  if (!rpcMissing && error) {
    if (error.message.includes("no streak freeze")) {
      return { ok: false, error: "Buy a streak freeze first." };
    }
    if (error.message.includes("already armed")) {
      return { ok: false, error: "Streak freeze is already armed." };
    }
    return { ok: false, error: error.message };
  }

  const state = await fetchStateForUser(supabase, user.id);
  if (!state) {
    return { ok: false, error: "Shop is not set up yet. Run supabase/apply_shop.sql." };
  }
  if (state.streakFreezeInventory < 1) {
    return { ok: false, error: "Buy a streak freeze first." };
  }
  if (state.streakFreezeArmed) {
    return { ok: false, error: "Streak freeze is already armed." };
  }

  const { error: updateErr } = await supabase
    .from("users")
    .update({
      shop_streak_freeze_inventory: state.streakFreezeInventory - 1,
      shop_streak_freeze_armed: true,
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
