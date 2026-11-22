// Purpose: Render a route-level forbidden workspace state.
// Used by: Wrong-role routes and unresolved role destinations.
import { ShieldAlert } from "lucide-react";

/** Renders an accessible 403 page using semantic error tokens. */
export default function ForbiddenPage() {
  return (
    <section
      aria-labelledby="forbidden-title"
      className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl items-center px-4 py-10"
    >
      <div className="w-full rounded-xl border border-error/20 bg-error-soft p-8 text-center">
        <ShieldAlert aria-hidden="true" className="mx-auto size-8 text-error" />
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-error">
          403 Forbidden
        </p>
        <h1 id="forbidden-title" className="mt-2 text-2xl font-semibold text-ink">
          Wrong role for this route
        </h1>
        <p className="mt-3 text-sm text-ink/70">
          Sign in with an account assigned to this route or switch to an available role.
        </p>
      </div>
    </section>
  );
}
