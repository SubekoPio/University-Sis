// Purpose: Label unavailable features with the semantic info status tokens.
// Used by: UI controls for features that are not enabled yet.
import { Info } from "lucide-react";
import { cn } from "cn";

type ComingSoonBadgeProps = {
  className?: string;
};

/**
 * Renders the informational "Coming soon" label for an unavailable feature.
 *
 * @param props - Optional class name for layout adjustments.
 * @returns An info-soft badge with an icon and visible text label.
 */
export function ComingSoonBadge({ className }: ComingSoonBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 text-xs font-semibold text-info",
        className,
      )}
    >
      <Info aria-hidden="true" className="size-3.5 shrink-0" />
      <span>Coming soon</span>
    </span>
  );
}
