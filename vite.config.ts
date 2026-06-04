import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/// <reference types="vitest" />

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  build: {
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@dnd-kit")) return "dndkit";
          if (
            id.includes("node_modules/@tauri-apps/api") ||
            id.includes("node_modules/@tauri-apps/plugin-")
          ) {
            return "tauri";
          }
          if (id.includes("node_modules/exceljs")) return "exceljs";
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest-setup.ts",
    exclude: ["**/node_modules/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/features/**",
        "src/services/**",
        "src/contexts/**",
      ],
      exclude: [
        "**/node_modules/**",
        "**/e2e/**",
        "src/features/activation/**",
      ],
      thresholds: {
        lines: 64,
        functions: 48,
        statements: 62,
        branches: 48,
        "src/features/generator/scheduler/validation/**": {
          lines: 75,
          functions: 75,
          statements: 75,
          branches: 70,
        },
        "src/services/export/**": {
          lines: 75,
          functions: 75,
          statements: 75,
          branches: 60,
        },
      },
    },
  },
});
