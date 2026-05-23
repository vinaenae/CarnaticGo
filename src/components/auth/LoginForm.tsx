"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveLoginEmail } from "@/app/auth/actions";
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

export function LoginForm() {
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
    toast.success("Signed in");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md border-primary/20 bg-card/90 shadow-xl shadow-primary/10 ring-1 ring-primary/10 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">Sign in</CardTitle>
        <CardDescription>Use your email or username and password.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
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
    </Card>
  );
}
