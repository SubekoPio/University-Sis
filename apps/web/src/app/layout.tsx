import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

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
      <body>{children}</body>
    </html>
  );
}
