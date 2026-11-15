"use client";

// Purpose: Provide a shadcn label primitive for accessible form controls.
// Used by: Authentication and other web forms.
import * as React from "react";
import { cn } from "cn";

/**
 * Renders a styled label that can be associated with an input.
 *
 * @param props - Native label properties and optional classes.
 * @returns A shadcn label element.
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
