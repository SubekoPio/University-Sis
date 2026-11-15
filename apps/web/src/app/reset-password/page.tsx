// Purpose: Render the password-reset page and accept an optional token query.
// Used by: Next.js App Router at /reset-password.
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

/**
 * Renders the password-reset page with an optional prefilled token.
 *
 * @param props - Next.js query parameters for the current route.
 * @returns The responsive reset-password page.
 */
export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  return (
    <AuthPageShell
      title="Choose a new password"
      description="Enter the one-time reset token from your email and choose a replacement password."
    >
      {/* Search parameters resolve below Suspense so the static shell can render immediately. */}
      <Suspense
        fallback={
          <p role="status" className="text-sm text-ink/70">
            Loading password reset form…
          </p>
        }
      >
        <ResetPasswordContent searchParams={searchParams} />
      </Suspense>
    </AuthPageShell>
  );
}

/**
 * Resolves the optional reset token inside the route's Suspense boundary.
 *
 * @param props - Next.js query parameters for this route.
 * @returns The reset form with any URL token prefilled.
 */
async function ResetPasswordContent({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;
  const initialToken = typeof token === "string" ? token : "";

  return (
    // Passing the query token to the client form keeps the page usable with pasted links.
    <ResetPasswordForm initialToken={initialToken} />
  );
}
