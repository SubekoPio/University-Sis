// Purpose: Render a placeholder protected home page until role content is implemented.
// Used by: Phase 2 role home routes.
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaceholderHomeProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Presents a consistent placeholder workspace state for a role home route.
 *
 * @param props - Role title, description, and Lucide icon.
 * @returns A placeholder card inside the app shell.
 */
export function PlaceholderHome({ title, description, icon: Icon }: PlaceholderHomeProps) {
  return (
    <section
      aria-labelledby="placeholder-home-title"
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
    >
      {/* Major content section is intentionally minimal until later Phase 2 pages ship. */}
      <Card className="border-line">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-info-soft text-info">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <CardTitle>
              <h1 id="placeholder-home-title" className="text-2xl font-semibold text-ink">
                {title}
              </h1>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="max-w-2xl text-sm leading-6 text-ink/70">{description}</p>
        </CardContent>
      </Card>
    </section>
  );
}
