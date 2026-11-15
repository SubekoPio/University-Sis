// Purpose: Render the email-verification page and accept an optional token query.
// Used by: Next.js App Router at /verify-email.
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

/**
 * Renders the verification page with optional token prefill.
 *
 * @param props - Next.js query parameters for the current route.
 * @returns The responsive email-verification page.
 */
export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  return (
    <AuthPageShell
      title="Verify your email"
      description="Paste the one-time token from your verification email to activate your account."
    >
      {/* Resolve dynamic query input below Suspense to preserve the static page shell. */}
      <Suspense
        fallback={
          <p role="status" className="text-sm text-ink/70">
            Loading verification form…
          </p>
        }
      >
        <VerifyEmailContent searchParams={searchParams} />
      </Suspense>
    </AuthPageShell>
  );
}

/**
 * Resolves an optional verification token inside the route's Suspense boundary.
 *
 * @param props - Next.js query parameters for this route.
 * @returns The verification form with any URL token prefilled.
 */
async function VerifyEmailContent({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  const initialToken = typeof token === "string" ? token : "";

  return (
    // The token can be pasted from the current Mailpit or email message.
    <VerifyEmailForm initialToken={initialToken} />
  );
}
