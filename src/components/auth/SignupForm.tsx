"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkEmailAvailable, checkUsernameAvailable } from "@/app/auth/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizeUsername, usernameValidationMessage } from "@/lib/username";

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (m.includes("duplicate") && m.includes("username")) {
    return "That username is already taken. Choose another.";
  }
  if (m.includes("users_username_format") || m.includes("username_format")) {
    return "Invalid username. Use 3–24 lowercase letters, numbers, or underscores.";
  }
  if (m.includes("users_username_lower_unique") || m.includes("unique constraint")) {
    return "That username is already taken. Choose another.";
  }
  return message;
}

export function SignupForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = firstName.trim();
    if (!trimmedName) {
      toast.error("Please enter your first name.");
      return;
    }

    const normalizedUsername = normalizeUsername(username);
    const usernameMsg = usernameValidationMessage(normalizedUsername);
    if (usernameMsg) {
      toast.error(usernameMsg);
      return;
    }

    setLoading(true);
    const usernameCheck = await checkUsernameAvailable(normalizedUsername);
    if (!usernameCheck.ok) {
      setLoading(false);
      toast.error(usernameCheck.message);
      return;
    }
    if (!usernameCheck.available) {
      setLoading(false);
      toast.error("That username is already taken. Choose another.");
      return;
    }

    if (!usernameCheck.verified) {
      console.warn(
        "Username availability RPC unavailable — continuing signup; DB will enforce uniqueness.",
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailCheck = await checkEmailAvailable(normalizedEmail);
    if (!emailCheck.ok) {
      setLoading(false);
      toast.error(emailCheck.message);
      return;
    }
    if (!emailCheck.available) {
      setLoading(false);
      toast.error("An account with this email already exists. Sign in instead.");
      return;
    }

    if (!emailCheck.verified) {
      console.warn(
        "Email availability RPC unavailable — continuing signup; auth will enforce uniqueness.",
      );
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          first_name: trimmedName.slice(0, 80),
          username: normalizedUsername,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error.message));
      return;
    }
    if (data.user && data.user.identities?.length === 0) {
      toast.error("An account with this email already exists. Sign in instead.");
      return;
    }
    toast.success("Check your email to confirm, or sign in if confirmations are disabled.");
    router.replace("/login");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md border-primary/20 bg-card/90 shadow-xl shadow-primary/10 ring-1 ring-primary/10 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">Create account</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="first-name">First name</Label>
            <Input
              id="first-name"
              type="text"
              autoComplete="given-name"
              required
              maxLength={80}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Priya"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              required
              maxLength={24}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="e.g. priya_vocal"
            />
            <p className="text-xs text-muted-foreground">
              3–24 characters: lowercase letters, numbers, underscores.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
            {loading ? "Creating…" : "Sign up"}
          </Button>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "inline-flex w-full justify-center sm:w-auto",
            )}
          >
            Already have an account?
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
