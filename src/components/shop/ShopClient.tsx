"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Award, Music, Snowflake } from "lucide-react";
import {
  armStreakFreeze,
  equipProfileBadge,
  purchaseShopItem,
  type ShopState,
} from "@/app/auth/shop-actions";
import { ShopShrutiBox } from "@/components/shop/ShopShrutiBox";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MAX_STREAK_FREEZE_INVENTORY,
  PROFILE_BADGES,
  SHOP_ITEMS,
  type ProfileBadgeId,
  type ShopItemId,
} from "@/lib/shop-items";
import { cn } from "@/lib/utils";

const ICONS = {
  snowflake: Snowflake,
  music: Music,
  award: Award,
} as const;

export function ShopClient({ initialState }: { initialState: ShopState | null }) {
  const [state, setState] = useState(initialState);
  const [selectedBadge, setSelectedBadge] = useState<ProfileBadgeId>("raga-star");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
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

  return (
    <div className="space-y-8">
      <Card className="border-primary/25 bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-4xl font-semibold tabular-nums text-primary">
            {state.quizPointsTotal}
            <span className="ml-2 text-base font-normal text-muted-foreground">points</span>
          </p>
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

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        {SHOP_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const owned =
            item.id === "shruti-box"
              ? state.shrutiBoxOwned
              : item.id === "profile-badge"
                ? state.profileBadge != null
                : false;
          const atMaxFreeze =
            item.id === "streak-freeze" &&
            state.streakFreezeInventory >= MAX_STREAK_FREEZE_INVENTORY;

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

                {item.id === "streak-freeze" ? (
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      In inventory:{" "}
                      <span className="font-medium text-foreground">
                        {state.streakFreezeInventory}
                      </span>
                      {state.streakFreezeArmed ? (
                        <span className="ml-2 font-medium text-primary">· Armed</span>
                      ) : null}
                    </p>
                    {state.streakFreezeInventory > 0 && !state.streakFreezeArmed ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={() => run(armStreakFreeze)}
                      >
                        Arm streak freeze
                      </Button>
                    ) : null}
                    {state.streakFreezeArmed ? (
                      <p>Will apply on your next login if you missed yesterday.</p>
                    ) : null}
                  </div>
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
                          onClick={() =>
                            run(() => equipProfileBadge(b.id))
                          }
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

                {!owned ? (
                  <Button
                    type="button"
                    disabled={
                      pending || !canBuy(item.price) || (item.id === "streak-freeze" && atMaxFreeze)
                    }
                    onClick={() =>
                      run(() =>
                        purchaseShopItem(
                          item.id as ShopItemId,
                          item.id === "profile-badge" ? selectedBadge : undefined,
                        ),
                      )
                    }
                  >
                    {atMaxFreeze ? "Inventory full" : canBuy(item.price) ? "Purchase" : "Need more points"}
                  </Button>
                ) : item.id !== "streak-freeze" ? (
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Owned</p>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || !canBuy(item.price) || atMaxFreeze}
                    onClick={() => run(() => purchaseShopItem("streak-freeze"))}
                  >
                    Buy another
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
