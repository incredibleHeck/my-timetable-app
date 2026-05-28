import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Tauri Setup", () => {
  const tauriConfigPath = path.resolve(__dirname, "../src-tauri/tauri.conf.json");

  it("should have a tauri.conf.json file", () => {
    expect(fs.existsSync(tauriConfigPath)).toBe(true);
  });

  it("should have a valid bundle identifier", () => {
    if (fs.existsSync(tauriConfigPath)) {
      const config = JSON.parse(fs.readFileSync(tauriConfigPath, "utf-8"));
      expect(config.identifier).toBeDefined();
      expect(config.identifier).not.toBe("com.tauri.dev"); // Should be changed from default
    }
  });
});
