"use client";

// Purpose: Submit a one-time email-verification token.
// Used by: The /verify-email route.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/ui/status-banner";
import { getApiErrorMessage, verifyEmail } from "@/lib/api-client";

const verifyEmailSchema = z.object({
  token: z
    .string()
    .min(1, "Paste the verification token from your email.")
    .max(512, "Verification tokens must be 512 characters or fewer."),
});

type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;

interface VerifyEmailFormProps {
  initialToken: string;
}

/**
 * Renders the email-verification form with query-token prefill support.
 *
 * @param props - Optional token provided in the current URL query string.
 * @returns A form that consumes a verification token once.
 */
export function VerifyEmailForm({ initialToken }: VerifyEmailFormProps) {
  const form = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { token: initialToken },
  });
  const mutation = useMutation({
    mutationFn: verifyEmail,
  });

  function onSubmit(values: VerifyEmailValues) {
    mutation.reset();
    mutation.mutate(values.token);
  }

  return (
    <div className="space-y-6">
      {/* Verification result uses a labeled status banner rather than color alone. */}
      {mutation.data !== undefined && (
        <StatusBanner variant="success">{mutation.data.message}</StatusBanner>
      )}
      {mutation.error !== null && (
        <StatusBanner variant="error">
          {getApiErrorMessage(
            mutation.error,
            "This verification token could not be used. Request another email and try again.",
          )}
        </StatusBanner>
      )}

      {/* Text tokens are supported because current emails deliver tokens directly. */}
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <AuthField
          id="verify-token"
          label="Verification token"
          autoComplete="one-time-code"
          placeholder="Paste the token from your email"
          registration={form.register("token")}
          error={form.formState.errors.token?.message}
        />

        {/* The button is disabled while the one-time token is being consumed. */}
        <Button type="submit" size="lg" disabled={mutation.isPending} className="h-11 w-full">
          {mutation.isPending && (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          )}
          {mutation.isPending ? "Verifying email…" : "Verify email"}
        </Button>
      </form>

      {/* The user can continue to login after the email status is verified. */}
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
