import Link from "next/link";
import { APP_NAME } from "@/lib/site";

export const metadata = {
  title: "Terms of Service",
  description: `The terms that govern your use of ${APP_NAME}.`,
};

const EFFECTIVE_DATE = "May 29, 2026";
const CONTACT_EMAIL = "support@ragifyapp.com";

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/login"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        ← Back
      </Link>

      <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section className="space-y-2">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of {APP_NAME}{" "}
            (the &quot;Service&quot;). By creating an account or using the Service, you agree to these
            Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">Using the Service</h2>
          <p>
            {APP_NAME} provides Carnatic vocal practice tools, including shruti detection, tala
            simulation, and raga quizzes. You may use the Service only in compliance with these Terms
            and all applicable laws.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">Your account</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              You are responsible for the information you provide and for keeping your login
              credentials secure.
            </li>
            <li>
              You must provide accurate information and are responsible for activity that occurs under
              your account.
            </li>
            <li>You must be at least 13 years old to use the Service.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Misuse, disrupt, or attempt to gain unauthorized access to the Service.</li>
            <li>Use the Service to violate any law or infringe the rights of others.</li>
            <li>Interfere with other users&apos; use of the Service.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">Content and data</h2>
          <p>
            Practice data, quiz results, and progress you generate are associated with your account.
            Our handling of your information is described in our{" "}
            <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Third-party datasets and licenses
          </h2>
          <p>
            The Service uses third-party datasets and models under their respective licenses.
            Attribution and license details are listed on the in-app About &amp; legal page.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Disclaimer and limitation of liability
          </h2>
          <p>
            The Service is provided &quot;as is&quot; without warranties of any kind. To the maximum
            extent permitted by law, {APP_NAME} is not liable for any indirect, incidental, or
            consequential damages arising from your use of the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">Termination</h2>
          <p>
            You may stop using the Service at any time. We may suspend or terminate access if you
            violate these Terms or to protect the Service and its users.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. When we do, we will revise the effective
            date above. Continued use of the Service after changes means you accept the updated Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">Contact us</h2>
          <p>
            Questions about these Terms? Contact us at{" "}
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
