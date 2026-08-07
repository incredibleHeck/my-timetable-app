import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/// <reference types="vitest" />

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
  },
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
        // Raised to just under the measured numbers after the Phase 1/4 test
        // work, so the coverage gained there cannot quietly regress. Leave ~1-2
        // points of headroom for normal run-to-run drift.
        lines: 77,
        functions: 62,
        statements: 74,
        branches: 59,
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
