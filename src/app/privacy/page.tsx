import Link from "next/link";
import { APP_NAME } from "@/lib/site";

export const metadata = {
  title: "Privacy Policy",
  description: `How ${APP_NAME} collects, uses, and protects your information.`,
};

const EFFECTIVE_DATE = "May 29, 2026";
const CONTACT_EMAIL = "support@ragify.app";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/login"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        ← Back
      </Link>

      <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section className="space-y-2">
          <p>
            {APP_NAME} (&quot;we&quot;, &quot;us&quot;, or &quot;the app&quot;) provides tools for
            Carnatic vocal practice, including shruti detection, tala simulation, and raga quizzes.
            This Privacy Policy explains what information we collect, how we use it, and the choices
            you have.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Information we collect
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-foreground">Account information.</span> When you sign
              up with email or Google, we collect your name, email address, and (optionally) a
              username. If you sign in with Google, we receive your basic profile details (name,
              email, profile picture) as permitted by your Google account.
            </li>
            <li>
              <span className="font-medium text-foreground">Practice and activity data.</span> We
              store your practice sessions, quiz results, points, streaks, and related progress so we
              can show your history and leaderboards.
            </li>
            <li>
              <span className="font-medium text-foreground">Microphone audio.</span> Practice
              features process audio from your microphone to detect pitch and rhythm. This processing
              happens in real time to give you feedback; we do not sell your audio.
            </li>
            <li>
              <span className="font-medium text-foreground">Technical data.</span> We may collect
              basic device and usage information needed to operate and secure the service.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            How we use your information
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>To create and manage your account and authenticate sign-ins.</li>
            <li>To provide practice feedback, save your progress, and power leaderboards.</li>
            <li>To maintain, secure, and improve the service.</li>
            <li>To communicate with you about your account or important changes.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            How your information is stored
          </h2>
          <p>
            Account and progress data are stored using Supabase (authentication and database) and
            hosted on Vercel. Access is protected by row-level security so you can only access your
            own data and data you are explicitly permitted to see (such as friends&apos; leaderboard
            entries).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Sharing your information
          </h2>
          <p>
            We do not sell your personal information. We share data only with service providers that
            help us run the app (such as hosting, authentication, and database providers), and only
            as needed to operate the service or comply with the law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">Your choices</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You can update your profile information from within the app.</li>
            <li>You can disconnect Google sign-in from your Google account settings.</li>
            <li>
              You can request deletion of your account and associated data by contacting us at the
              email below.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">Children&apos;s privacy</h2>
          <p>
            The app is not directed to children under 13, and we do not knowingly collect personal
            information from them.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Changes to this policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. When we do, we will revise the
            effective date above.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">Contact us</h2>
          <p>
            If you have questions about this Privacy Policy, contact us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
