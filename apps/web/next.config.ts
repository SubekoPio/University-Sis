// Purpose: Configure Next.js rendering features and Tailwind's Turbopack CSS loader.
// Used by: Next.js for development and production builds of the web app.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable the app-router caching and partial-prefetch behavior used by this project.
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // Route imported CSS through Tailwind's Turbopack integration.
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
