// Purpose: Define the project's semantic brand palette for Tailwind compatibility.
// Used by: The Tailwind v4 compatibility directive in src/app/globals.css.
const config = {
  theme: {
    extend: {
      colors: {
        brand: "#312E81", // Deep Indigo: navigation rail.
        accent: "#4F46E5", // Electric Indigo: primary CTAs, links, and focus rings.
        badge: "#0D9488", // Teal: GPA and attendance badges only.
        surface: "#F9FAFB", // Page background.
        card: "#FFFFFF", // Cards, tables, and modals.
        ink: "#111827", // Primary text.
        line: "#E5E7EB", // Decorative borders and dividers.
        field: "#6B7280", // Input borders.
        success: {
          DEFAULT: "#15803D", // Positive status text and icons.
          soft: "#DCFCE7", // Positive status backgrounds.
        },
        warning: {
          DEFAULT: "#B45309", // Caution status text and icons.
          soft: "#FEF3C7", // Caution status backgrounds.
        },
        error: {
          DEFAULT: "#B91C1C", // Error status text and icons.
          soft: "#FEE2E2", // Error status backgrounds.
        },
        info: {
          DEFAULT: "#4F46E5", // Informational text and icons.
          soft: "#EEF2FF", // Informational status backgrounds.
        },
      },
    },
  },
} as const;

export default config;
