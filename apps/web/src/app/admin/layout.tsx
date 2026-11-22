// Purpose: Guard the administrator workspace and mount the shared app shell.
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** Renders administrator pages inside the shared app shell. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AppShell role="admin">{children}</AppShell>;
}
