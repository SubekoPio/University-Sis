// Purpose: Guard admissions workspaces and mount the shared app shell.
import type { ReactNode } from "react";
import { AdmissionsRoleShell } from "@/components/layout/admissions-role-shell";

/** Renders the admissions page for either admissions role. */
export default function AdmissionsLayout({ children }: { children: ReactNode }) {
  return <AdmissionsRoleShell>{children}</AdmissionsRoleShell>;
}
