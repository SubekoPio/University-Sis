// Purpose: Render an accessible shadcn input with a connected label and error.
// Used by: Authentication forms.
import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AuthFieldProps {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  type?: "email" | "password" | "text";
  autoComplete?: string;
  placeholder?: string;
  error?: string;
}

/**
 * Renders a labeled input and its field-level validation feedback.
 *
 * @param props - Input identity, React Hook Form registration, and field state.
 * @returns An accessible form field with semantic error styling.
 */
export function AuthField({
  id,
  label,
  registration,
  type = "text",
  autoComplete,
  placeholder,
  error,
}: AuthFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      {/* Keep the label explicitly associated with the control for assistive technology. */}
      <Label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        className="h-11 border-field bg-card text-ink placeholder:text-ink/50 focus-visible:border-accent focus-visible:ring-accent"
        {...registration}
      />
      {/* Field errors stay adjacent to their input and use the semantic error token. */}
      {error !== undefined && (
        <p id={errorId} className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
