"use server";

import { unstable_noStore as noStore } from "next/cache";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername, usernameValidationMessage } from "@/lib/username";
import {
  localCalendarDayString,
  syncUserLoginStreakCache,
} from "@/lib/user-streak";

export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_login_email", {
    p_identifier: trimmed,
  });

  if (error) {
    console.error("resolve_login_email", error.message);
    return trimmed.includes("@") ? trimmed.toLowerCase() : null;
  }

  return typeof data === "string" && data.length > 0 ? data : null;
}

export type UsernameCheckResult =
  | { ok: true; available: true; verified: boolean }
  | { ok: true; available: false; verified: boolean }
  | { ok: false; message: string };

export type EmailCheckResult =
  | { ok: true; available: true; verified: boolean }
  | { ok: true; available: false; verified: boolean }
  | { ok: false; message: string };

function emailValidationMessage(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "Please enter your email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "Please enter a valid email address.";
  }
  return null;
}

/**
 * Returns whether email appears free.
 * If the DB RPC is missing, returns available so signup can continue — auth will enforce uniqueness.
 */
export async function checkEmailAvailable(email: string): Promise<EmailCheckResult> {
  const msg = emailValidationMessage(email);
  if (msg) return { ok: false, message: msg };

  const normalized = email.trim().toLowerCase();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_email_available", {
    p_email: normalized,
  });

  if (error) {
    console.warn("is_email_available skipped:", error.message);
    return { ok: true, available: true, verified: false };
  }

  if (data === true) return { ok: true, available: true, verified: true };
  return { ok: true, available: false, verified: true };
}

/**
 * Returns whether username appears free.
 * If the DB RPC is missing (migration / schema cache), returns available so signup
 * can continue — uniqueness is enforced when the profile row is created.
 */
export async function checkUsernameAvailable(username: string): Promise<UsernameCheckResult> {
  const msg = usernameValidationMessage(username);
  if (msg) return { ok: false, message: msg };

  const normalized = normalizeUsername(username);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_username_available", {
    p_username: normalized,
  });

  if (error) {
    console.warn("is_username_available skipped:", error.message);
    return { ok: true, available: true, verified: false };
  }

  if (data === true) return { ok: true, available: true, verified: true };
  return { ok: true, available: false, verified: true };
}

export type FriendLookup = {
  id: string;
  username: string;
  first_name: string | null;
};

async function fetchUserByUsername(
  supabase: Awaited<ReturnType<typeof createClient>>,
  normalized: string,
): Promise<{ row: FriendLookup | null; error?: string }> {
  const { data: row, error } = await supabase
    .from("users")
    .select("id, username, first_name")
    .eq("username", normalized)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return {
        row: null,
        error:
          "Database is missing username support. In Supabase SQL Editor, run supabase/fix_add_username_column.sql on your project, then try again.",
      };
    }
    return { row: null, error: error.message };
  }

  if (!row?.id || !row.username) return { row: null };

  return {
    row: {
      id: row.id,
      username: row.username,
      first_name: row.first_name,
    },
  };
}

export async function lookupUserByUsername(
  username: string,
): Promise<{ user: FriendLookup | null; error?: string }> {
  const msg = usernameValidationMessage(username);
  if (msg) return { user: null, error: msg };

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { user: null, error: "Sign in required." };

  const normalized = normalizeUsername(username);

  const direct = await fetchUserByUsername(supabase, normalized);
  if (direct.error) return { user: null, error: direct.error };
  if (direct.row) {
    if (direct.row.id === authUser.id) {
      return { user: null, error: "You cannot add yourself." };
    }
    return { user: direct.row };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("lookup_user_by_username", {
    p_username: normalized,
  });

  if (!rpcError) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (row?.id) {
      if (row.id === authUser.id) {
        return { user: null, error: "You cannot add yourself." };
      }
      return {
        user: {
          id: row.id as string,
          username: row.username as string,
          first_name: (row.first_name as string | null) ?? null,
        },
      };
    }
  }

  return { user: null };
}

export async function addFriendByUsername(
  username: string,
): Promise<{ ok: boolean; error?: string }> {
  const lookup = await lookupUserByUsername(username);
  if (lookup.error) return { ok: false, error: lookup.error };
  if (!lookup.user) return { ok: false, error: "No user found with that username." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const { error } = await supabase.from("user_friendships").insert({
    user_id: user.id,
    friend_id: lookup.user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Already on your friends list." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { ok: true };
}

export type LeaderboardRow = {
  rank: number;
  user_id: string;
  username: string | null;
  first_name: string | null;
  /** From public.users.login_streak_current (updated when that user opens the app). */
  currentStreak: number;
  is_self: boolean;
};

type FriendsStreakLeaderboardRpcRow = {
  rank: number;
  user_id: string;
  username: string | null;
  first_name: string | null;
  login_streak_current: number;
  login_streak_best: number;
  is_self: boolean;
};

type LeaderboardProfile = {
  id: string;
  username: string | null;
  first_name: string | null;
  is_self: boolean;
};

function rankStreakLeaderboard(
  entries: { profile: LeaderboardProfile; currentStreak: number }[],
): LeaderboardRow[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    const uA = (a.profile.username ?? "").toLowerCase();
    const uB = (b.profile.username ?? "").toLowerCase();
    if (uA !== uB) return uA.localeCompare(uB);
    return a.profile.id.localeCompare(b.profile.id);
  });

  return sorted.map((row, index) => ({
    rank: index + 1,
    user_id: row.profile.id,
    username: row.profile.username,
    first_name: row.profile.first_name,
    currentStreak: row.currentStreak,
    is_self: row.profile.is_self,
  }));
}

const PROFILE_SELECT = "id, username, first_name, login_streak_current";

function usernameFromAuthMetadata(user: { user_metadata?: Record<string, unknown> }): string | null {
  const raw = user.user_metadata?.username;
  if (typeof raw !== "string") return null;
  const normalized = normalizeUsername(raw);
  return usernameValidationMessage(normalized) ? null : normalized;
}

function mapRpcLeaderboardRows(rows: FriendsStreakLeaderboardRpcRow[]): LeaderboardRow[] {
  return rows.map((row) => ({
    rank: Number(row.rank),
    user_id: row.user_id,
    username: row.username,
    first_name: row.first_name,
    currentStreak: Math.max(0, row.login_streak_current ?? 0),
    is_self: row.is_self,
  }));
}

/** Fallback: read login_streak_current from users only (no client-side recompute). */
async function getFriendsStreakLeaderboardFromProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  authUser: { user_metadata?: Record<string, unknown> },
): Promise<LeaderboardRow[]> {
  const { data: selfRow } = await supabase
    .from("users")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  const profiles: LeaderboardProfile[] = [];
  const selfUsername = selfRow?.username ?? usernameFromAuthMetadata(authUser);
  profiles.push({
    id: selfRow?.id ?? userId,
    username: selfUsername,
    first_name:
      selfRow?.first_name ??
      (typeof authUser.user_metadata?.first_name === "string"
        ? authUser.user_metadata.first_name
        : null),
    is_self: true,
  });

  const { data: friendLinks } = await supabase
    .from("user_friendships")
    .select("friend_id")
    .eq("user_id", userId);

  const friendIds = (friendLinks ?? []).map((l) => l.friend_id as string).filter(Boolean);
  let friendRows: {
    id: string;
    username: string | null;
    first_name: string | null;
    login_streak_current: number | null;
  }[] = [];

  if (friendIds.length > 0) {
    const { data } = await supabase
      .from("users")
      .select(PROFILE_SELECT)
      .in("id", friendIds);

    friendRows = data ?? [];
    for (const row of friendRows) {
      profiles.push({
        id: row.id,
        username: row.username,
        first_name: row.first_name,
        is_self: false,
      });
    }
  }

  const streakById = new Map<string, number>();
  if (selfRow && typeof selfRow.login_streak_current === "number") {
    streakById.set(selfRow.id, selfRow.login_streak_current);
  }
  for (const row of friendRows) {
    if (typeof row.login_streak_current === "number") {
      streakById.set(row.id, row.login_streak_current);
    }
  }

  const ranked = profiles.map((profile) => ({
    profile,
    currentStreak: streakById.get(profile.id) ?? 0,
  }));

  return rankStreakLeaderboard(ranked);
}

/**
 * Leaderboard uses each person's saved login_streak_current on public.users
 * (synced when they open the app). Does not invent streaks client-side.
 */
export async function getFriendsStreakLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  await syncUserLoginStreakCache(supabase, user.id, localCalendarDayString());

  const { data, error } = await supabase.rpc("get_friends_streak_leaderboard");

  if (error) {
    console.error("get_friends_streak_leaderboard:", error.message);
    return getFriendsStreakLeaderboardFromProfiles(supabase, user.id, user);
  }

  return mapRpcLeaderboardRows((data ?? []) as FriendsStreakLeaderboardRpcRow[]);
}

export type PointsLeaderboardRow = {
  rank: number;
  user_id: string;
  username: string | null;
  first_name: string | null;
  quizPointsTotal: number;
  quizCorrectStreak: number;
  shopProfileBadge: string | null;
  is_self: boolean;
};

type FriendsPointsLeaderboardRpcRow = {
  rank: number;
  user_id: string;
  username: string | null;
  first_name: string | null;
  quiz_points_total: number;
  quiz_correct_streak: number;
  shop_profile_badge: string | null;
  is_self: boolean;
};

const PROFILE_POINTS_SELECT =
  "id, username, first_name, quiz_points_total, quiz_correct_streak, shop_profile_badge";

function rankPointsLeaderboard(
  entries: {
    profile: LeaderboardProfile;
    quizPointsTotal: number;
    quizCorrectStreak: number;
    shopProfileBadge: string | null;
  }[],
): PointsLeaderboardRow[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.quizPointsTotal !== a.quizPointsTotal) {
      return b.quizPointsTotal - a.quizPointsTotal;
    }
    const uA = (a.profile.username ?? "").toLowerCase();
    const uB = (b.profile.username ?? "").toLowerCase();
    if (uA !== uB) return uA.localeCompare(uB);
    return a.profile.id.localeCompare(b.profile.id);
  });

  return sorted.map((row, index) => ({
    rank: index + 1,
    user_id: row.profile.id,
    username: row.profile.username,
    first_name: row.profile.first_name,
    quizPointsTotal: row.quizPointsTotal,
    quizCorrectStreak: row.quizCorrectStreak,
    shopProfileBadge: row.shopProfileBadge,
    is_self: row.profile.is_self,
  }));
}

async function getFriendsPointsLeaderboardFromProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  authUser: { user_metadata?: Record<string, unknown> },
): Promise<PointsLeaderboardRow[]> {
  const { data: selfRow } = await supabase
    .from("users")
    .select(PROFILE_POINTS_SELECT)
    .eq("id", userId)
    .maybeSingle();

  const profiles: LeaderboardProfile[] = [];
  const selfUsername = selfRow?.username ?? usernameFromAuthMetadata(authUser);
  profiles.push({
    id: selfRow?.id ?? userId,
    username: selfUsername,
    first_name:
      selfRow?.first_name ??
      (typeof authUser.user_metadata?.first_name === "string"
        ? authUser.user_metadata.first_name
        : null),
    is_self: true,
  });

  const { data: friendLinks } = await supabase
    .from("user_friendships")
    .select("friend_id")
    .eq("user_id", userId);

  const friendIds = (friendLinks ?? []).map((l) => l.friend_id as string).filter(Boolean);
  let friendRows: {
    id: string;
    username: string | null;
    first_name: string | null;
    quiz_points_total: number | null;
    quiz_correct_streak: number | null;
    shop_profile_badge: string | null;
  }[] = [];

  if (friendIds.length > 0) {
    const { data } = await supabase
      .from("users")
      .select(PROFILE_POINTS_SELECT)
      .in("id", friendIds);

    friendRows = data ?? [];
    for (const row of friendRows) {
      profiles.push({
        id: row.id,
        username: row.username,
        first_name: row.first_name,
        is_self: false,
      });
    }
  }

  const pointsById = new Map<
    string,
    { total: number; streak: number; badge: string | null }
  >();
  if (selfRow) {
    pointsById.set(selfRow.id, {
      total: selfRow.quiz_points_total ?? 0,
      streak: selfRow.quiz_correct_streak ?? 0,
      badge: selfRow.shop_profile_badge ?? null,
    });
  }
  for (const row of friendRows) {
    pointsById.set(row.id, {
      total: row.quiz_points_total ?? 0,
      streak: row.quiz_correct_streak ?? 0,
      badge: row.shop_profile_badge ?? null,
    });
  }

  const ranked = profiles.map((profile) => {
    const p = pointsById.get(profile.id) ?? { total: 0, streak: 0, badge: null };
    return {
      profile,
      quizPointsTotal: p.total,
      quizCorrectStreak: p.streak,
      shopProfileBadge: p.badge,
    };
  });

  return rankPointsLeaderboard(ranked);
}

/** Friends leaderboard ranked by lifetime quiz points from `public.users` (not login streak). */
export async function getFriendsPointsLeaderboard(): Promise<PointsLeaderboardRow[]> {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_friends_points_leaderboard");

  if (error) {
    console.error("get_friends_points_leaderboard:", error.message);
    return getFriendsPointsLeaderboardFromProfiles(supabase, user.id, user);
  }

  return (data ?? []).map((row: FriendsPointsLeaderboardRpcRow) => ({
    rank: Number(row.rank),
    user_id: row.user_id,
    username: row.username,
    first_name: row.first_name,
    quizPointsTotal: Math.max(0, row.quiz_points_total ?? 0),
    quizCorrectStreak: Math.max(0, row.quiz_correct_streak ?? 0),
    shopProfileBadge: row.shop_profile_badge ?? null,
    is_self: row.is_self,
  }));
}
