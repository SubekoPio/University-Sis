// Purpose: Provide a consistent responsive layout for authentication pages.
// Used by: Login, forgot-password, reset-password, and verify-email routes.
import { BookOpenCheck, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

interface AuthPageShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * Renders a branded authentication card and responsive introduction panel.
 *
 * @param props - Page title, explanatory text, and form content.
 * @returns A responsive auth page section using semantic brand tokens.
 */
export function AuthPageShell({ title, description, children }: AuthPageShellProps) {
  return (
    <section
      aria-labelledby="auth-page-title"
      className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 md:grid-cols-2 md:gap-12">
        {/* The brand panel gives desktop views context without crowding mobile forms. */}
        <div className="hidden rounded-2xl bg-brand p-10 text-card shadow-xl md:flex md:min-h-[30rem] md:flex-col md:justify-between lg:p-12">
          <div className="space-y-8">
            {/* The logo uses the system's icon and brand surface rather than a new color. */}
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-card text-brand">
                <BookOpenCheck aria-hidden="true" className="size-6" />
              </span>
              <div>
                <p className="text-lg font-bold tracking-tight">University SIS</p>
                <p className="text-sm text-card/75">Student information system</p>
              </div>
            </div>

            {/* This short introduction keeps the account purpose clear on wide screens. */}
            <div className="max-w-sm space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-card/75">
                Account access
              </p>
              <h2 className="text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
                Your academic services, securely connected.
              </h2>
              <p className="text-base leading-7 text-card/80">
                Sign in or manage your account details using your verified university email.
              </p>
            </div>
          </div>

          {/* A visible icon and label communicate the security note without color alone. */}
          <div className="flex items-center gap-3 border-t border-card/20 pt-6 text-sm text-card/85">
            <ShieldCheck aria-hidden="true" className="size-5 shrink-0" />
            <p>Protected access for students and university staff</p>
          </div>
        </div>

        {/* The compact brand mark keeps the same identity on narrow screens. */}
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="flex items-center gap-3 md:hidden">
            <span className="grid size-11 place-items-center rounded-xl bg-brand text-card">
              <BookOpenCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="font-bold tracking-tight text-ink">University SIS</p>
              <p className="text-sm text-ink/70">Account access</p>
            </div>
          </div>

          {/* The shadcn card groups the form and its page-specific heading. */}
          <Card className="border-line shadow-lg shadow-brand/5">
            <CardHeader className="gap-2 px-6 pt-7 sm:px-8 sm:pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                University SIS
              </p>
              <h1 id="auth-page-title" className="text-2xl font-semibold tracking-tight text-ink">
                {title}
              </h1>
              <CardDescription className="text-base leading-6 text-ink/70">
                {description}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-7 sm:px-8 sm:pb-8">{children}</CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
