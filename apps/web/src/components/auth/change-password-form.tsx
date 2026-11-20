"use client";

// Purpose: Validate and submit the forced temporary-password change.
// Used by: The /change-password route.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  changeTemporaryPassword,
  getPasswordChangeNotice,
  getApiErrorMessage,
  getCurrentAuthUser,
  logout,
  subscribeToAuthState,
} from "@/lib/api-client";

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Enter your temporary password.")
      .max(1024, "Passwords must be 1024 characters or fewer."),
    newPassword: z
      .string()
      .min(1, "Enter a new password.")
      .max(1024, "Passwords must be 1024 characters or fewer."),
    confirmPassword: z
      .string()
      .min(1, "Confirm your new password.")
      .max(1024, "Passwords must be 1024 characters or fewer."),
  })
  .superRefine((values, context) => {
    if (values.newPassword === values.currentPassword) {
      context.addIssue({
        code: "custom",
        message: "Your new password must differ from the temporary password.",
        path: ["newPassword"],
      });
    }
    if (values.newPassword !== values.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "The passwords do not match.",
        path: ["confirmPassword"],
      });
    }
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

/**
 * Renders the required password-change form and handles expired credentials.
 *
 * @returns A validated form connected to the temporary-password API.
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const user = useSyncExternalStore(subscribeToAuthState, getCurrentAuthUser, () => null);
  const notice = useSyncExternalStore(subscribeToAuthState, getPasswordChangeNotice, () => null);
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const mutation = useMutation({
    mutationFn: changeTemporaryPassword,
    onSuccess: () => router.replace("/"),
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => router.replace("/login"),
  });

  useEffect(() => {
    if (user === null) {
      router.replace("/login");
      return;
    }

    if (user.mustChangePassword !== true) {
      router.replace("/");
      return;
    }
  }, [router, user]);

  function onSubmit(values: ChangePasswordValues) {
    mutation.reset();
    mutation.mutate({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
  }

  const apiErrorMessage =
    mutation.error === null
      ? null
      : getApiErrorMessage(mutation.error, "We could not change your password. Please try again.");
  const currentNotice = apiErrorMessage ?? notice;
  const temporaryPasswordExpired =
    currentNotice?.toLowerCase().includes("temporary password has expired") ?? false;

  if (user?.mustChangePassword !== true) {
    return (
      <p role="status" className="text-sm text-ink/70">
        Checking your sign-in session…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preserve the API's expiration guidance and make it explicit to the user. */}
      {notice !== null && (
        <StatusBanner variant={temporaryPasswordExpired ? "error" : "info"}>
          {temporaryPasswordExpired
            ? "Your temporary password has expired. Contact an administrator."
            : notice}
        </StatusBanner>
      )}
      {mutation.error !== null && (
        <StatusBanner variant="error">
          {temporaryPasswordExpired
            ? "Your temporary password has expired. Contact an administrator."
            : apiErrorMessage}
        </StatusBanner>
      )}

      {/* Require the current credential, replacement, and matching confirmation. */}
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <AuthField
          id="temporary-password"
          label="Current temporary password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your temporary password"
          registration={form.register("currentPassword")}
          error={form.formState.errors.currentPassword?.message}
        />
        <AuthField
          id="new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="Choose a new password"
          hint="Use 1–1024 characters. It must differ from your temporary password; a unique passphrase is recommended."
          registration={form.register("newPassword")}
          error={form.formState.errors.newPassword?.message}
        />
        <AuthField
          id="confirm-new-password"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="Enter your new password again"
          registration={form.register("confirmPassword")}
          error={form.formState.errors.confirmPassword?.message}
        />

        {/* The primary action preserves the server session while the password changes. */}
        <Button
          type="submit"
          size="lg"
          disabled={mutation.isPending || logoutMutation.isPending}
          className="h-11 w-full"
        >
          {mutation.isPending && (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          )}
          {mutation.isPending ? "Updating password…" : "Change password"}
        </Button>
      </form>

      {/* Expired credentials cannot be changed; logging out lets the user leave safely. */}
      {temporaryPasswordExpired && (
        <Button
          type="button"
          variant="outline"
          disabled={logoutMutation.isPending}
          className="w-full"
          onClick={() => logoutMutation.mutate()}
        >
          {logoutMutation.isPending ? "Signing out…" : "Sign out"}
        </Button>
      )}
      {logoutMutation.error !== null && (
        <StatusBanner variant="error">
          {getApiErrorMessage(logoutMutation.error, "We could not sign you out.")}
        </StatusBanner>
      )}
    </div>
  );
}
