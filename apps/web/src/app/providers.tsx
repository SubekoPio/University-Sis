"use client";

// Purpose: Provide one stable TanStack Query client to client-side routes.
// Used by: The root layout for authentication and later server-state mutations.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

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
    // Keep query state stable across client re-renders and route transitions.
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
