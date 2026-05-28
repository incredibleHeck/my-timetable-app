import "@testing-library/jest-dom";
import { vi } from "vitest";
import type { ReactNode } from "react";

export const mockPushToHistory = vi.fn();

vi.mock("./src/components/ui/Toast", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  useToast: () => ({ showToast: vi.fn() }),
  notify: vi.fn(),
  registerToastHandler: vi.fn(),
}));

vi.mock("./src/contexts/HistoryContext", () => ({
  HistoryProvider: ({ children }: { children: ReactNode }) => children,
  useHistory: () => ({
    undo: vi.fn(),
    redo: vi.fn(),
    pushToHistory: mockPushToHistory,
    canUndo: false,
    canRedo: false,
  }),
}));
