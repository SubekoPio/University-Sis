"use client";

// Purpose: Validate credentials and submit the login mutation to the API.
// Used by: The /login route.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, getApiErrorMessage, login } from "@/lib/api-client";
import { AuthField } from "@/components/auth/auth-field";
import { StatusBanner } from "@/components/ui/status-banner";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address.")
    .max(320, "Email addresses must be 320 characters or fewer."),
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(1024, "Passwords must be 1024 characters or fewer."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Renders the login form with validation and pending, error, and success states.
 *
 * @returns A credential form connected to the authentication API.
 */
export function LoginForm() {
  const router = useRouter();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      router.replace(result.user.mustChangePassword === true ? "/change-password" : "/");
    },
  });

  function onSubmit(values: LoginFormValues) {
    mutation.reset();
    mutation.mutate(values);
  }

  const errorMessage =
    mutation.error instanceof ApiError &&
    mutation.error.message.toLowerCase().includes("temporary password has expired")
      ? "Your temporary password has expired. Contact an administrator."
      : getApiErrorMessage(mutation.error, "We could not sign you in. Please try again.");

  return (
    <div className="space-y-6">
      {/* Keep API feedback visible and labeled independently from field errors. */}
      {mutation.error !== null && <StatusBanner variant="error">{errorMessage}</StatusBanner>}

      {/* The form uses native semantics while React Hook Form handles field validation. */}
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <AuthField
          id="login-email"
          label="University email"
          type="email"
          autoComplete="email"
          placeholder="name@example.edu"
          registration={form.register("email")}
          error={form.formState.errors.email?.message}
        />
        <AuthField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          registration={form.register("password")}
          error={form.formState.errors.password?.message}
        />
        {/* Password recovery stays adjacent to the password control for quick access. */}
        <div className="-mt-3 flex justify-end">
          <Link
            href="/forgot-password"
            className="rounded-sm text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Forgot password?
          </Link>
        </div>

        {/* The primary action exposes a textual loading state as well as an icon. */}
        <Button type="submit" size="lg" disabled={mutation.isPending} className="h-11 w-full">
          {mutation.isPending && (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          )}
          {mutation.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/* Verification and recovery routes remain discoverable on small screens. */}
      <p className="text-center text-sm text-ink/70">
        Need to verify your email?{" "}
        <Link
          href="/verify-email"
          className="rounded-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Verify email
        </Link>
      </p>
    </div>
  );
}
