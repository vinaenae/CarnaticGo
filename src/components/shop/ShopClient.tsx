"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Award, Music, Snowflake, Trophy, Zap } from "lucide-react";
import {
  armStreakFreeze,
  equipNicknameTrophy,
  equipProfileBadge,
  getShopState,
  purchaseShopItem,
  type ShopState,
} from "@/app/auth/shop-actions";
import { ShopShrutiBox } from "@/components/shop/ShopShrutiBox";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { syncLocalPracticeToServer } from "@/lib/sync-practice-to-server";
import {
  formatMultiplierRemaining,
  isPointsMultiplierActive,
  NICKNAME_TROPHIES,
  PRACTICE_STREAK_MIN_MS,
  PROFILE_BADGES,
  SHOP_ITEMS,
  SHOP_POINTS_MULTIPLIER,
  STREAK_FREEZE_SHOP,
  STREAK_FREEZE_TIERS,
  type NicknameTrophyId,
  type ProfileBadgeId,
  type ShopItemId,
  type StreakFreezeDays,
} from "@/lib/shop-items";
import { cn } from "@/lib/utils";

const ICONS = {
  snowflake: Snowflake,
  music: Music,
  award: Award,
  zap: Zap,
  trophy: Trophy,
} as const;

function formatPracticeMin(ms: number): string {
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return m > 0 ? `${m}m` : `${s}s`;
}

export function ShopClient({ initialState }: { initialState: ShopState | null }) {
  const [state, setState] = useState(initialState);
  const [selectedBadge, setSelectedBadge] = useState<ProfileBadgeId>("raga-star");
  const [selectedTrophy, setSelectedTrophy] = useState<NicknameTrophyId>("tala-champion");
  const [selectedFreezeDays, setSelectedFreezeDays] = useState<StreakFreezeDays>(1);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [syncingPractice, setSyncingPractice] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      setSyncingPractice(true);
      await syncLocalPracticeToServer(user.id);
      if (cancelled) return;

      const next = await getShopState();
      if (!cancelled && next) setState(next);
      setSyncingPractice(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in to open the shop</CardTitle>
          <CardDescription>
            Earn quiz points while signed in, then spend them here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className={buttonVariants()}>
            Sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string; state?: ShopState }>) => {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok && res.state) {
        setState(res.state);
        setMessage("Updated!");
      } else {
        setMessage(res.error ?? "Something went wrong.");
      }
    });
  };

  const canBuy = (price: number) => state.quizPointsTotal >= price;
  const multiplierActive = isPointsMultiplierActive(state.pointsMultiplierUntil);
  const multiplierLabel = formatMultiplierRemaining(state.pointsMultiplierUntil);
  const streakDaysDone = state.practiceStreakDays.filter((d) => d.qualified).length;

  return (
    <div className="space-y-8">
      <Card className="border-primary/25 bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-heading text-4xl font-semibold tabular-nums text-primary">
            {state.quizPointsTotal}
            <span className="ml-2 text-base font-normal text-muted-foreground">points</span>
          </p>
          {multiplierActive ? (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {SHOP_POINTS_MULTIPLIER}× quiz points active
              {multiplierLabel ? ` · ${multiplierLabel}` : ""}
            </p>
          ) : null}
          {syncingPractice ? (
            <p className="text-xs text-muted-foreground">Syncing practice time…</p>
          ) : null}
        </CardContent>
      </Card>

      {message ? (
        <p
          className={cn(
            "text-sm",
            message === "Updated!" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
          )}
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="flex flex-col sm:col-span-2 xl:col-span-3">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Snowflake className="size-5" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-lg">{STREAK_FREEZE_SHOP.name}</CardTitle>
                <CardDescription className="mt-1">{STREAK_FREEZE_SHOP.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.streakFreezeArmedDays > 0 ? (
              <p className="text-xs font-medium text-primary">
                {state.streakFreezeArmedDays}-day freeze armed — applies on your next login for up
                to that many consecutive missed days.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STREAK_FREEZE_TIERS.map((tier) => {
                const inv = state.streakFreezeInventory[tier.days];
                const atMax = inv >= tier.maxInventory;
                const selected = selectedFreezeDays === tier.days;
                return (
                  <div
                    key={tier.itemId}
                    className={cn(
                      "flex flex-col rounded-lg border p-3",
                      selected ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setSelectedFreezeDays(tier.days)}
                    >
                      <p className="text-sm font-medium text-foreground">{tier.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Forgives up to {tier.days} missed day{tier.days === 1 ? "" : "s"} in a row
                      </p>
                      <p className="mt-2 text-sm font-semibold tabular-nums">{tier.price} pts</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        In inventory:{" "}
                        <span className="font-medium text-foreground">
                          {inv}/{tier.maxInventory}
                        </span>
                      </p>
                    </button>
                    <div className="mt-3 flex flex-col gap-2">
                      {inv > 0 && state.streakFreezeArmedDays === 0 ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={pending || !selected}
                          onClick={() => run(() => armStreakFreeze(tier.days))}
                        >
                          Arm {tier.days}-day freeze
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || !canBuy(tier.price) || atMax || !selected}
                        onClick={() =>
                          run(() => purchaseShopItem(tier.itemId as ShopItemId))
                        }
                      >
                        {atMax
                          ? "Tier full"
                          : canBuy(tier.price)
                            ? "Purchase"
                            : "Need more points"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {SHOP_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const owned =
            item.id === "shruti-box"
              ? state.shrutiBoxOwned
              : item.id === "profile-badge"
                ? state.profileBadge != null
                : false;
          const trophyOwned = (id: NicknameTrophyId) =>
            state.nicknameTrophiesOwned.includes(id);

          return (
            <Card key={item.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription className="mt-1">{item.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <p className="text-sm font-medium tabular-nums text-foreground">
                  {item.price} points
                </p>

                {item.id === "points-multiplier" && multiplierActive ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Boost active{multiplierLabel ? ` — ${multiplierLabel}` : ""}
                  </p>
                ) : null}

                {item.id === "shruti-box" && state.shrutiBoxOwned ? (
                  <ShopShrutiBox />
                ) : null}

                {item.id === "profile-badge" && state.profileBadge ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Equipped badge — switch style:</p>
                    <div className="flex flex-wrap gap-2">
                      {PROFILE_BADGES.map((b) => (
                        <Button
                          key={b.id}
                          type="button"
                          size="sm"
                          variant={state.profileBadge === b.id ? "default" : "outline"}
                          disabled={pending}
                          onClick={() => run(() => equipProfileBadge(b.id))}
                        >
                          <span className="mr-1">{b.shortLabel}</span>
                          {b.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {item.id === "profile-badge" && !state.profileBadge ? (
                  <div className="flex flex-wrap gap-2">
                    {PROFILE_BADGES.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className={cn(
                          "rounded-lg border px-2 py-1.5 text-xs transition-colors",
                          selectedBadge === b.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/50",
                        )}
                        onClick={() => setSelectedBadge(b.id)}
                      >
                        <span className="mr-1">{b.shortLabel}</span>
                        {b.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {item.id === "nickname-trophy" ? (
                  <div className="space-y-3 text-xs text-muted-foreground">
                    <p>
                      Practice streak:{" "}
                      <span className="font-medium text-foreground">
                        {streakDaysDone}/7 days
                      </span>{" "}
                      with 15+ min sing-with-tāla
                      {state.practiceStreakEligible ? (
                        <span className="ml-1 font-medium text-emerald-600 dark:text-emerald-400">
                          · Eligible
                        </span>
                      ) : null}
                    </p>
                    <ul className="space-y-1">
                      {state.practiceStreakDays.map((d) => (
                        <li key={d.day} className="flex justify-between gap-2">
                          <span>{d.day}</span>
                          <span
                            className={
                              d.qualified
                                ? "font-medium text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }
                          >
                            {formatPracticeMin(d.practiceMs)}
                            {d.qualified ? " ✓" : ` / ${formatPracticeMin(PRACTICE_STREAK_MIN_MS)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {state.nicknameTrophiesOwned.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-foreground">Equipped nickname — switch:</p>
                        <div className="flex flex-wrap gap-2">
                          {NICKNAME_TROPHIES.filter((t) =>
                            state.nicknameTrophiesOwned.includes(t.id),
                          ).map((t) => (
                            <Button
                              key={t.id}
                              type="button"
                              size="sm"
                              variant={state.nicknameTrophy === t.id ? "default" : "outline"}
                              disabled={pending}
                              onClick={() => run(() => equipNicknameTrophy(t.id))}
                            >
                              {t.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {NICKNAME_TROPHIES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            disabled={trophyOwned(t.id)}
                            className={cn(
                              "rounded-lg border px-2 py-1.5 text-xs transition-colors",
                              trophyOwned(t.id)
                                ? "cursor-not-allowed border-border/60 opacity-50"
                                : selectedTrophy === t.id
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:bg-muted/50",
                            )}
                            onClick={() => setSelectedTrophy(t.id)}
                          >
                            {t.label}
                            {trophyOwned(t.id) ? " (owned)" : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {item.id === "points-multiplier" || item.id === "nickname-trophy" ? (
                  <Button
                    type="button"
                    disabled={
                      pending ||
                      !canBuy(item.price) ||
                      (item.id === "nickname-trophy" &&
                        (!state.practiceStreakEligible || trophyOwned(selectedTrophy)))
                    }
                    onClick={() =>
                      run(() =>
                        purchaseShopItem(
                          item.id as ShopItemId,
                          item.id === "nickname-trophy" ? selectedTrophy : undefined,
                        ),
                      )
                    }
                  >
                    {item.id === "nickname-trophy" && trophyOwned(selectedTrophy)
                      ? "Already owned"
                      : item.id === "nickname-trophy" && !state.practiceStreakEligible
                        ? "Complete 7-day practice streak"
                        : canBuy(item.price)
                          ? item.id === "points-multiplier" && multiplierActive
                            ? "Extend boost"
                            : "Purchase"
                          : "Need more points"}
                  </Button>
                ) : !owned ? (
                  <Button
                    type="button"
                    disabled={pending || !canBuy(item.price)}
                    onClick={() =>
                      run(() =>
                        purchaseShopItem(
                          item.id as ShopItemId,
                          item.id === "profile-badge" ? selectedBadge : undefined,
                        ),
                      )
                    }
                  >
                    {canBuy(item.price) ? "Purchase" : "Need more points"}
                  </Button>
                ) : (
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Owned</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
