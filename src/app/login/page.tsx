import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { OAuthCodeRedirect } from "@/components/auth/OAuthCodeRedirect";
import { TypewriterAppName } from "@/components/brand/TypewriterAppName";
import { LocalDevBanner } from "@/components/layout/LocalDevBanner";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const { error, code } = await searchParams;
  const authError =
    error === "auth"
      ? "Google sign-in failed. Try again or use email and password."
      : undefined;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <LocalDevBanner />
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-14">
      {code ? <OAuthCodeRedirect /> : null}
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-24 size-[26rem] rounded-full bg-chart-2/25 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 size-72 -translate-x-1/2 rounded-full bg-accent/40 blur-2xl"
        aria-hidden
      />

      <div className="relative mb-10 max-w-lg text-center">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-accent">AI vocal coach</p>
        <h1 className="font-heading text-4xl text-foreground sm:text-5xl">
          <TypewriterAppName />
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
          Real-time shruti detection, tala simulation, and raga intelligence for your practice.
        </p>
      </div>
      <LoginForm authError={authError} />
      <p className="relative mt-6 text-center text-xs text-muted-foreground">
        <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
          Privacy Policy
        </Link>
        <span className="mx-2">·</span>
        <Link href="/terms" className="underline-offset-2 hover:text-foreground hover:underline">
          Terms of Service
        </Link>
      </p>
      </div>
    </div>
  );
}
