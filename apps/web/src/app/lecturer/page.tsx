// Purpose: Render the placeholder lecturer home page.
import { Presentation } from "lucide-react";
import { PlaceholderHome } from "@/components/layout/placeholder-home";

/** Renders the lecturer workspace landing page. */
export default function LecturerHomePage() {
  return (
    <PlaceholderHome
      title="Lecturer Home"
      description="Your assigned course units, class sessions, attendance reviews, and announcements will appear here."
      icon={Presentation}
    />
  );
}
