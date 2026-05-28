import { describe, it, expect, vi, beforeEach } from "vitest";
import { isTauriEnv, isWebEnv } from "../src/utils/platform";

describe("Platform Utilities", () => {
  beforeEach(() => {
    vi.stubGlobal("__TAURI__", undefined);
    vi.stubGlobal("__TAURI_INTERNALS__", undefined);
  });

  it("should detect Tauri environment when __TAURI__ is present", () => {
    vi.stubGlobal("__TAURI__", {});
    expect(isTauriEnv()).toBe(true);
    expect(isWebEnv()).toBe(false);
  });

  it("should detect Tauri environment when __TAURI_INTERNALS__ is present", () => {
    vi.stubGlobal("__TAURI_INTERNALS__", {});
    expect(isTauriEnv()).toBe(true);
    expect(isWebEnv()).toBe(false);
  });

  it("should detect web environment when no Tauri globals are present", () => {
    expect(isTauriEnv()).toBe(false);
    expect(isWebEnv()).toBe(true);
  });
});
