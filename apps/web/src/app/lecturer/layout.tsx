// Purpose: Guard the lecturer workspace and mount the shared app shell.
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** Renders lecturer pages inside the shared lecturer app shell. */
export default function LecturerLayout({ children }: { children: ReactNode }) {
  return <AppShell role="lecturer">{children}</AppShell>;
}
