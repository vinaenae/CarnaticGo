"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addFriendByUsername } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { normalizeUsername, usernameValidationMessage } from "@/lib/username";

export function AddFriendCard() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeUsername(username);
    const msg = usernameValidationMessage(normalized);
    if (msg) {
      toast.error(msg);
      return;
    }

    setLoading(true);
    const result = await addFriendByUsername(normalized);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error ?? "Could not add friend.");
      return;
    }

    toast.success(`Added @${normalized} to your friends.`);
    setUsername("");
    router.refresh();
  }

  return (
    <Card className="h-full w-full border-primary/15">
      <CardHeader className="space-y-1 p-4 pb-2">
        <CardTitle className="text-sm font-semibold">Add a friend</CardTitle>
        <CardDescription className="text-xs leading-snug">
          Enter their username to compare quiz points on the leaderboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <div className="space-y-1">
            <Label htmlFor="friend-username" className="sr-only">
              Friend username
            </Label>
            <Input
              id="friend-username"
              type="text"
              autoComplete="off"
              placeholder="friend_username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              maxLength={24}
              className="h-9 text-sm"
            />
          </div>
          <Button type="submit" disabled={loading} size="sm" className="w-full">
            {loading ? "Adding…" : "Add friend"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
