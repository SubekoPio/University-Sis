// Purpose: Render the placeholder bursar finance page.
import { ReceiptText } from "lucide-react";
import { PlaceholderHome } from "@/components/layout/placeholder-home";

/** Renders the bursar workspace landing page. */
export default function FinanceHomePage() {
  return (
    <PlaceholderHome
      title="Application Fees"
      description="Confirmed application-fee deposits and bank references will appear here. The full Finance home arrives in Phase 3."
      icon={ReceiptText}
    />
  );
}
