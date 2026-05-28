import { LoginForm } from "@/components/auth/LoginForm";
import { TypewriterAppName } from "@/components/brand/TypewriterAppName";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const authError =
    error === "auth"
      ? "Google sign-in failed. Try again or use email and password."
      : undefined;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-14">
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
          Real-time pitch, rhythm, and raga intelligence for your practice.
        </p>
      </div>
      <LoginForm authError={authError} />
    </div>
  );
}
