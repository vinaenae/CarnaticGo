import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";
import { continueAsGuest } from "@/app/auth/guest-actions";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/site";

export default function SignupPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-14">
      <div
        className="pointer-events-none absolute -left-20 top-0 size-[24rem] rounded-full bg-chart-3/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 right-0 size-[28rem] rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />

      <div className="relative mb-10 max-w-lg text-center">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-accent">Get started</p>
        <h1 className="font-heading text-4xl text-foreground sm:text-5xl">
          Create your account
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {APP_NAME} — music-tech practice with AI pitch and raga tools.
        </p>
      </div>
      <SignupForm />
      <form action={continueAsGuest} className="relative mt-6 w-full max-w-md">
        <Button type="submit" variant="ghost" className="w-full text-muted-foreground">
          Continue without an account
        </Button>
      </form>
    </div>
  );
}
