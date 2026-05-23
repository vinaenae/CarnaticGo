"use server";

import { createClient } from "@/lib/supabase/server";

export type HoldSwaraBestResult =
  | { ok: true; bestSeconds: number; signedIn: true }
  | { ok: true; bestSeconds: 0; signedIn: false }
  | { ok: false; error?: string };

type UpsertRpcPayload = {
  best_seconds?: number;
};

/** Load the signed-in user's all-time best for this shruti key (0 if none). */
export async function getHoldSwaraBestSeconds(
  tanpuraKey: string,
): Promise<HoldSwaraBestResult> {
  const key = tanpuraKey.trim();
  if (!key) return { ok: true, bestSeconds: 0, signedIn: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: true, bestSeconds: 0, signedIn: false };

  const { data, error } = await supabase
    .from("user_hold_swara_bests")
    .select("best_seconds")
    .eq("user_id", user.id)
    .eq("tanpura_key", key)
    .maybeSingle();

  if (error) {
    const missingTable =
      error.message.includes("user_hold_swara_bests") || error.code === "PGRST205";
    if (missingTable) {
      return {
        ok: false,
        error:
          "Hold swara scores are not set up yet. Run supabase/apply_hold_swara.sql in the Supabase SQL Editor.",
      };
    }
    console.error("getHoldSwaraBestSeconds:", error.message);
    return { ok: false, error: error.message };
  }

  const sec = data?.best_seconds;
  return {
    ok: true,
    bestSeconds: typeof sec === "number" && sec > 0 ? sec : 0,
    signedIn: true,
  };
}

/** Persist a new personal best when seconds beats the stored value. */
export async function saveHoldSwaraBestSeconds(
  tanpuraKey: string,
  seconds: number,
): Promise<HoldSwaraBestResult> {
  const key = tanpuraKey.trim();
  if (!key || !(seconds > 0)) return { ok: true, bestSeconds: 0, signedIn: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: true, bestSeconds: seconds, signedIn: false };

  const { data, error } = await supabase.rpc("upsert_hold_swara_best", {
    p_tanpura_key: key,
    p_seconds: seconds,
  });

  if (!error) {
    const payload = (typeof data === "object" && data !== null ? data : {}) as UpsertRpcPayload;
    const stored = Number(payload.best_seconds ?? seconds);
    return {
      ok: true,
      bestSeconds: stored > 0 ? stored : seconds,
      signedIn: true,
    };
  }

  const rpcMissing =
    error.message.includes("upsert_hold_swara_best") ||
    error.message.includes("user_hold_swara_bests") ||
    error.code === "PGRST202";

  if (rpcMissing) {
    return await saveHoldSwaraBestViaTable(supabase, user.id, key, seconds);
  }

  console.error("upsert_hold_swara_best:", error.message);
  return { ok: false, error: error.message };
}

async function saveHoldSwaraBestViaTable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tanpuraKey: string,
  seconds: number,
): Promise<HoldSwaraBestResult> {
  const { data: row, error: readErr } = await supabase
    .from("user_hold_swara_bests")
    .select("best_seconds")
    .eq("user_id", userId)
    .eq("tanpura_key", tanpuraKey)
    .maybeSingle();

  if (readErr) {
    const missingTable =
      readErr.message.includes("user_hold_swara_bests") || readErr.code === "PGRST205";
    if (missingTable) {
      return {
        ok: false,
        error:
          "Hold swara scores are not set up yet. Run supabase/apply_hold_swara.sql in the Supabase SQL Editor.",
      };
    }
    console.error("saveHoldSwaraBestViaTable read:", readErr.message);
    return { ok: false, error: readErr.message };
  }

  const prev = row?.best_seconds ?? 0;
  if (seconds <= prev) {
    return { ok: true, bestSeconds: prev, signedIn: true };
  }

  if (row) {
    const { error: updateErr } = await supabase
      .from("user_hold_swara_bests")
      .update({ best_seconds: seconds, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("tanpura_key", tanpuraKey);
    if (updateErr) {
      console.error("saveHoldSwaraBestViaTable update:", updateErr.message);
      return { ok: false, error: updateErr.message };
    }
  } else {
    const { error: insertErr } = await supabase.from("user_hold_swara_bests").insert({
      user_id: userId,
      tanpura_key: tanpuraKey,
      best_seconds: seconds,
    });
    if (insertErr) {
      console.error("saveHoldSwaraBestViaTable insert:", insertErr.message);
      return { ok: false, error: insertErr.message };
    }
  }

  return { ok: true, bestSeconds: seconds, signedIn: true };
}
