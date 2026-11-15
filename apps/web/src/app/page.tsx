// Purpose: Direct the root URL to the primary account access page.
// Used by: Next.js App Router at /.
import { redirect } from "next/navigation";

/**
 * Redirects the placeholder root route to login.
 *
 * @returns Never returns; Next.js redirects to /login.
 */
export default function Home() {
  redirect("/login");
}
