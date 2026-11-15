"use client";

// Purpose: Validate and submit a one-time password-reset token.
// Used by: The /reset-password route.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/ui/status-banner";
import { getApiErrorMessage, resetPassword } from "@/lib/api-client";

const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .min(1, "Paste the reset token from your email.")
      .max(512, "Reset tokens must be 512 characters or fewer."),
    password: z
      .string()
      .min(1, "Enter a new password.")
      .max(1024, "Passwords must be 1024 characters or fewer."),
    confirmPassword: z
      .string()
      .min(1, "Confirm your new password.")
      .max(1024, "Passwords must be 1024 characters or fewer."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  initialToken: string;
}

/**
 * Renders the reset form and validates that both password entries match.
 *
 * @param props - Optional token prefilled from a link query parameter.
 * @returns A one-time password reset form.
 */
export function ResetPasswordForm({ initialToken }: ResetPasswordFormProps) {
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: initialToken,
      password: "",
      confirmPassword: "",
    },
  });
  const mutation = useMutation({
    mutationFn: resetPassword,
  });

  function onSubmit(values: ResetPasswordValues) {
    mutation.reset();
    mutation.mutate({ token: values.token, password: values.password });
  }

  return (
    <div className="space-y-6">
      {/* Successful reset and invalid/expired tokens get explicit text and status icons. */}
      {mutation.data !== undefined && (
        <StatusBanner variant="success">{mutation.data.message}</StatusBanner>
      )}
      {mutation.error !== null && (
        <StatusBanner variant="error">
          {getApiErrorMessage(
            mutation.error,
            "The reset link could not be used. Request a new one and try again.",
          )}
        </StatusBanner>
      )}

      {/* The token remains editable for the current text-token email workflow. */}
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <AuthField
          id="reset-token"
          label="Reset token"
          autoComplete="one-time-code"
          placeholder="Paste the token from your email"
          registration={form.register("token")}
          error={form.formState.errors.token?.message}
        />
        <AuthField
          id="reset-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="Enter a new password"
          registration={form.register("password")}
          error={form.formState.errors.password?.message}
        />
        <AuthField
          id="reset-confirm-password"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter the new password"
          registration={form.register("confirmPassword")}
          error={form.formState.errors.confirmPassword?.message}
        />

        {/* A textual loading label remains available to screen readers. */}
        <Button type="submit" size="lg" disabled={mutation.isPending} className="h-11 w-full">
          {mutation.isPending && (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          )}
          {mutation.isPending ? "Updating password…" : "Reset password"}
        </Button>
      </form>

      {/* Login is the next step after a successful reset. */}
      <p className="text-center text-sm text-ink/70">
        <Link
          href="/login"
          className="rounded-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
