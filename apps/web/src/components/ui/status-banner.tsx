// Purpose: Render accessible status messages using the semantic status palette.
// Used by: Web UI surfaces that need a success, warning, error, or info message.
import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

type StatusBannerVariant = "success" | "warning" | "error" | "info";

type StatusBannerProps = {
  variant: StatusBannerVariant;
  children: ReactNode;
  className?: string;
};

const statusPresentation: Record<
  StatusBannerVariant,
  { label: string; icon: LucideIcon; className: string }
> = {
  success: {
    label: "Success",
    icon: CircleCheck,
    className: "border-success/30 bg-success-soft text-success",
  },
  warning: {
    label: "Warning",
    icon: TriangleAlert,
    className: "border-warning/30 bg-warning-soft text-warning",
  },
  error: {
    label: "Error",
    icon: CircleX,
    className: "border-error/30 bg-error-soft text-error",
  },
  info: {
    label: "Information",
    icon: Info,
    className: "border-info/30 bg-info-soft text-info",
  },
};

/**
 * Renders a status message with a visible icon and text label.
 *
 * @param props - The status variant, message content, and optional class name.
 * @returns An accessible status banner.
 */
export function StatusBanner({ variant, children, className }: StatusBannerProps) {
  const { label, icon: Icon, className: variantClassName } = statusPresentation[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-atomic="true"
      className={cn("flex items-start gap-3 rounded-lg border p-4", variantClassName, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}
