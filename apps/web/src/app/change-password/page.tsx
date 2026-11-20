// Purpose: Render the required password-change route for temporary credentials.
// Used by: Next.js App Router at /change-password.
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

/**
 * Renders the current-password, new-password, and confirmation form.
 *
 * @returns The temporary-password change page.
 */
export default function ChangePasswordPage() {
  return (
    <AuthPageShell
      title="Change your password"
      description="Your administrator-issued temporary password must be replaced before you continue."
    >
      {/* The form validates the password policy and submits through the API client. */}
      <ChangePasswordForm />
    </AuthPageShell>
  );
}
