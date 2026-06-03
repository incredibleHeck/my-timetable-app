import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useActivation } from "../src/hooks/useActivation";

const ACTIVATION_STORAGE_KEY = "eduscheduler_activated_key";

describe("useActivation hook", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize as unactivated when localStorage is empty", () => {
    const { result } = renderHook(() => useActivation());

    expect(result.current.isActivated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should initialize as activated when localStorage has activation key", () => {
    localStorage.setItem(ACTIVATION_STORAGE_KEY, "EDU-TEST-TEST-TEST");
    const { result } = renderHook(() => useActivation());

    expect(result.current.isActivated).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should successfully activate with a valid product key format", async () => {
    const { result } = renderHook(() => useActivation());

    let activationPromise: Promise<boolean> | undefined;
    act(() => {
      activationPromise = result.current.activate("EDU-ABCD-1234-WXYZ");
    });

    // Verify it transitions to loading state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    // Fast-forward the 800ms simulated network delay
    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    const success = await activationPromise;
    expect(success).toBe(true);
    expect(result.current.isActivated).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(localStorage.getItem(ACTIVATION_STORAGE_KEY)).toBe("EDU-ABCD-1234-WXYZ");
  });

  it("should reject invalid product key formats and set an error", async () => {
    const { result } = renderHook(() => useActivation());

    let activationPromise: Promise<boolean> | undefined;
    act(() => {
      activationPromise = result.current.activate("INVALID-KEY-FORMAT");
    });

    // Fast-forward the delay
    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    const success = await activationPromise;
    expect(success).toBe(false);
    expect(result.current.isActivated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toContain("Invalid product key format");
    expect(localStorage.getItem(ACTIVATION_STORAGE_KEY)).toBeNull();
  });

  it("should normalize product key to uppercase in storage", async () => {
    const { result } = renderHook(() => useActivation());

    let activationPromise: Promise<boolean> | undefined;
    act(() => {
      activationPromise = result.current.activate("edu-abcd-1234-wxyz");
    });

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    const success = await activationPromise;
    expect(success).toBe(true);
    expect(localStorage.getItem(ACTIVATION_STORAGE_KEY)).toBe("EDU-ABCD-1234-WXYZ");
  });
});
