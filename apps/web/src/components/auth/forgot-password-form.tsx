"use client";

// Purpose: Request password-reset instructions with account-safe feedback.
// Used by: The /forgot-password route.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/ui/status-banner";
import { forgotPassword, getApiErrorMessage } from "@/lib/api-client";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address.")
    .max(320, "Email addresses must be 320 characters or fewer."),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/**
 * Renders the forgot-password form and enumeration-safe success state.
 *
 * @returns An email form connected to the password-recovery endpoint.
 */
export function ForgotPasswordForm() {
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const mutation = useMutation({
    mutationFn: forgotPassword,
  });

  function onSubmit(values: ForgotPasswordValues) {
    mutation.reset();
    mutation.mutate(values.email);
  }

  return (
    <div className="space-y-6">
      {/* The API intentionally uses the same message for existing and unknown accounts. */}
      {mutation.data !== undefined && (
        <StatusBanner variant="success">{mutation.data.message}</StatusBanner>
      )}
      {mutation.error !== null && (
        <StatusBanner variant="error">
          {getApiErrorMessage(
            mutation.error,
            "We could not process your request. Please try again.",
          )}
        </StatusBanner>
      )}

      {/* Keep the request form narrow and comfortable on mobile. */}
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <AuthField
          id="forgot-email"
          label="University email"
          type="email"
          autoComplete="email"
          placeholder="name@example.edu"
          registration={form.register("email")}
          error={form.formState.errors.email?.message}
        />

        {/* Pending text communicates progress even when motion is reduced. */}
        <Button type="submit" size="lg" disabled={mutation.isPending} className="h-11 w-full">
          {mutation.isPending && (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          )}
          {mutation.isPending ? "Sending request…" : "Send reset instructions"}
        </Button>
      </form>

      {/* Return navigation is visible without relying on browser controls. */}
      <p className="text-center text-sm text-ink/70">
        Remembered your password?{" "}
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
