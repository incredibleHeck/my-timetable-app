import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/// <reference types="vitest" />

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest-setup.ts",
  },
});
