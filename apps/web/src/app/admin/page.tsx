// Purpose: Render the placeholder administrator home page.
import { ShieldCheck } from "lucide-react";
import { PlaceholderHome } from "@/components/layout/placeholder-home";

/** Renders the administrator workspace landing page. */
export default function AdminHomePage() {
  return (
    <PlaceholderHome
      title="Administrator Home"
      description="Staff user accounts and roles are available here. Feature flags and audit logs arrive in later phases."
      icon={ShieldCheck}
    />
  );
}
