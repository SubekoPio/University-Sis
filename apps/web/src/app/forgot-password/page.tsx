// Purpose: Render the password-recovery request page.
// Used by: Next.js App Router at /forgot-password.
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

/**
 * Renders the email-entry page for password reset.
 *
 * @returns The responsive forgot-password page.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      title="Forgot your password?"
      description="Enter your university email and we’ll send reset instructions if an account matches."
    >
      {/* The backend response is intentionally generic to prevent account enumeration. */}
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
