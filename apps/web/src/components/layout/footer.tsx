// Purpose: Render the shared brand-token footer across web routes.
// Used by: The root layout.

/**
 * Renders the responsive site footer using only design-system brand tokens.
 *
 * @returns A footer with the product name and current copyright year.
 */
export function Footer() {
  return (
    <footer className="border-t border-card/20 bg-brand text-card">
      {/* Keep the footer content legible and aligned at every viewport width. */}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="font-semibold">University SIS</p>
        <p className="text-card/80">© University SIS · Student information system</p>
      </div>
    </footer>
  );
}
