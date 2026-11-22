// Purpose: Render the placeholder registrar home page.
import { Building2 } from "lucide-react";
import { PlaceholderHome } from "@/components/layout/placeholder-home";

/** Renders the registrar workspace landing page. */
export default function RegistrarHomePage() {
  return (
    <PlaceholderHome
      title="Registrar Home"
      description="Academic structure, intakes, curriculum, offerings, students, announcements, and calendar will appear here."
      icon={Building2}
    />
  );
}
