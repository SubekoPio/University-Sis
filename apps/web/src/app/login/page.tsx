// Purpose: Render the University SIS login page.
// Used by: Next.js App Router at /login.
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/auth/login-form";

/**
 * Renders the login page and links to account recovery and verification.
 *
 * @returns The responsive login page.
 */
export default function LoginPage() {
  return (
    <AuthPageShell
      title="Welcome back"
      description="Sign in with your university account to continue."
    >
      {/* The form handles validation and API mutation states on the client. */}
      <LoginForm />
    </AuthPageShell>
  );
}
