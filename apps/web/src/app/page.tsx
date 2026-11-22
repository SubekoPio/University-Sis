"use client";

// Purpose: Render the signed-in entry point for the University SIS application.
// Used by: Next.js App Router at /.
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBanner } from "@/components/ui/status-banner";
import { getCurrentAuthUser, logout, subscribeToAuthState } from "@/lib/api-client";
import { getDefaultRoleRoute, resolveSessionRoles } from "@/lib/auth-role";

/**
 * Renders a signed-in landing page and routes unauthenticated visitors to login.
 *
 * @returns The current account's app entry point.
 */
export default function Home() {
  const router = useRouter();
  const user = useSyncExternalStore(subscribeToAuthState, getCurrentAuthUser, () => null);
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => router.replace("/login"),
  });

  useEffect(() => {
    if (user === null) {
      router.replace("/login");
      return;
    }
    if (user.mustChangePassword === true) {
      router.replace("/change-password");
      return;
    }
    let active = true;
    void resolveSessionRoles().then((roles) => {
      if (!active) return;
      router.replace(getDefaultRoleRoute(roles) ?? "/403");
    });
    return () => {
      active = false;
    };
  }, [router, user]);

  if (user === null || user.mustChangePassword === true) {
    return (
      <section
        aria-label="Checking sign-in"
        className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-7xl items-center justify-center px-4"
      >
        {/* Keep the initial session check readable while client-side storage loads. */}
        <p role="status" className="flex items-center gap-2 text-sm text-ink/70">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Checking your sign-in session…
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="home-title"
      className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8"
    >
      {/* The signed-in welcome card is the app destination until feature workspaces exist. */}
      <Card className="mx-auto w-full max-w-2xl border-line shadow-lg shadow-brand/5">
        <CardHeader className="gap-3 px-6 pt-7 sm:px-8 sm:pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            University SIS
          </p>
          <h1 id="home-title" className="text-2xl font-semibold tracking-tight text-ink">
            Welcome, {user.email}
          </h1>
          <p className="text-base leading-6 text-ink/70">
            You are signed in to the University SIS application.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-7 sm:px-8 sm:pb-8">
          {/* The visible icon and label make the authenticated state clear without color alone. */}
          <StatusBanner variant="success">
            Your account is ready. Academic and account features will appear here as they become
            available.
          </StatusBanner>

          {/* Sign-out clears the current session through the shared API client. */}
          <Button
            type="button"
            variant="outline"
            disabled={logoutMutation.isPending}
            className="w-full sm:w-auto"
            onClick={() => logoutMutation.mutate()}
          >
            {logoutMutation.isPending && (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            )}
            {logoutMutation.isPending ? "Signing out…" : "Sign out"}
          </Button>
          {logoutMutation.error !== null && (
            <StatusBanner variant="error">
              Your browser session was cleared, but sign-out could not be confirmed.
            </StatusBanner>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
