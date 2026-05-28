"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { continueAsGuest, clearGuestSession } from "@/app/auth/guest-actions";
import { resolveLoginEmail } from "@/app/auth/actions";
import { AuthOAuthDivider } from "@/components/auth/AuthOAuthDivider";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function LoginForm({ authError }: { authError?: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) {
      toast.error("Enter your email or username.");
      return;
    }

    setLoading(true);
    const email = await resolveLoginEmail(trimmed);
    if (!email) {
      setLoading(false);
      toast.error("No account found for that email or username.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await clearGuestSession();
    toast.success("Signed in");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md border-primary/20 bg-card/90 shadow-xl shadow-primary/10 ring-1 ring-primary/10 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">Sign in</CardTitle>
        <CardDescription>Use Google or your email and password.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GoogleSignInButton label="Sign in with Google" />
        <AuthOAuthDivider />
        {authError ? (
          <p className="text-sm text-destructive" role="alert">
            {authError}
          </p>
        ) : null}
      </CardContent>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email or username</Label>
            <Input
              id="identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or your_username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "inline-flex w-full justify-center sm:w-auto",
            )}
          >
            Create an account
          </Link>
        </CardFooter>
      </form>
      <CardContent className="space-y-3 border-t border-border pt-4">
        <form action={continueAsGuest}>
          <Button type="submit" variant="outline" className="w-full">
            Continue without an account
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          Guest mode: practice and quizzes work locally. Sign in to save points, shop, and
          leaderboard.
        </p>
      </CardContent>
    </Card>
  );
}
