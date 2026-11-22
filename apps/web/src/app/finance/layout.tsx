// Purpose: Guard the bursar workspace and mount the shared app shell.
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** Renders bursar pages inside the shared app shell. */
export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <AppShell role="bursar">{children}</AppShell>;
}
