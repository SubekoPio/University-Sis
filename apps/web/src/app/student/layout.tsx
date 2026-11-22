// Purpose: Guard the student workspace and mount the shared app shell.
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** Renders student pages only inside the shared student app shell. */
export default function StudentLayout({ children }: { children: ReactNode }) {
  return <AppShell role="student">{children}</AppShell>;
}
