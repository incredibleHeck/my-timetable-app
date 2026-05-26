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
    chunkSizeWarningLimit: 600,
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
  },
});
