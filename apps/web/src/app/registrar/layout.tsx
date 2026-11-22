// Purpose: Guard the registrar workspace and mount the shared app shell.
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** Renders registrar pages inside the shared registrar app shell. */
export default function RegistrarLayout({ children }: { children: ReactNode }) {
  return <AppShell role="registrar">{children}</AppShell>;
}
