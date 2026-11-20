"use client";

// Purpose: Provide one stable TanStack Query client to client-side routes.
// Used by: The root layout for authentication and later server-state mutations.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { getCurrentAuthUser, subscribeToAuthState } from "@/lib/api-client";

/**
 * Wraps route content in a browser-scoped query client.
 *
 * @param props - Children rendered beneath the query provider.
 * @returns A provider boundary for TanStack Query hooks.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
          mutations: { retry: false },
        },
      }),
  );

  return (
    // Keep query state stable and route forced-change accounts from every client page.
    <QueryClientProvider client={queryClient}>
      <ForcedPasswordChangeRedirect />
      {children}
    </QueryClientProvider>
  );
}

/**
 * Routes sessions requiring a temporary-password change to the dedicated form.
 *
 * @returns No UI; synchronizes the current route with the API's auth state.
 */
function ForcedPasswordChangeRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSyncExternalStore(subscribeToAuthState, getCurrentAuthUser, () => null);

  useEffect(() => {
    if (user?.mustChangePassword === true && pathname !== "/change-password") {
      router.replace("/change-password");
    }
  }, [pathname, router, user]);

  return null;
}
