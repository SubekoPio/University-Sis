// Purpose: Provide the shared document shell, providers, and footer for the web app.
// Used by: Every Next.js App Router page.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/footer";
import { Providers } from "./providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "University SIS",
  description: "University student information system",
};

/**
 * Provides the shared HTML shell and metadata for every app route.
 *
 * @param props - Route content rendered inside the document body.
 * @returns The root HTML layout for the application.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="flex min-h-screen flex-col bg-surface text-ink">
        {/* Keep server-state mutations and the shared footer available to every route. */}
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-card px-4 py-2 text-sm font-semibold text-ink shadow-lg focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Skip to content
        </a>
        <Providers>
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
