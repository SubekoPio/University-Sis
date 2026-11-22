// Purpose: Render the placeholder admissions home page.
import { ClipboardCheck } from "lucide-react";
import { PlaceholderHome } from "@/components/layout/placeholder-home";

/** Renders the admissions workspace landing page. */
export default function AdmissionsHomePage() {
  return (
    <PlaceholderHome
      title="Admissions Home"
      description="Applications, document review, admissions decisions, application fees, and study-mode changes will appear here."
      icon={ClipboardCheck}
    />
  );
}
