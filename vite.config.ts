import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  // Base path for the application. Essential for correct asset loading when deployed
  // and when proxied by Vercel Dev.
  // '/' ensures paths are absolute from the root of the serving domain.
  base: '/',
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      // Alias for your client-side source directory
      "@": path.resolve(import.meta.dirname, "client", "src"),
      // Alias for shared utilities/schema
      "@shared": path.resolve(import.meta.dirname, "shared"),
      // Alias for attached assets
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  // This tells Vite where your client-side source code lives.
  // When Vite serves in development, it treats this directory as its root.
  root: path.resolve(import.meta.dirname, "client"),
  // Build configuration for production.
  build: {
    // === IMPORTANT CHANGE HERE ===
    // This now tells Vite to output the build directly into 'dist'
    // relative to its 'root' (which is 'client/').
    // So, the output will be in 'your-project-root/client/dist'.
    outDir: "dist",
    // Ensures the output directory is cleaned before a new build.
    emptyOutDir: true,
  },
  // Server configuration for development. Crucial for `vercel dev`.
  server: {
    // Explicitly set the port Vite should use for its *internal* dev server.
    // Vercel dev will then proxy to this port.
    port: 5173,
    // Vite's Host Module Replacement (HMR) setup.
    hmr: {
      overlay: false,
    },
    // Specify the host for the dev server. '0.0.0.0' makes it accessible externally.
    host: '0.0.0.0',
  }
});
