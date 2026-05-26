import "@testing-library/jest-dom";
import { vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("./src/components/ui/Toast", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  useToast: () => ({ showToast: vi.fn() }),
  notify: vi.fn(),
  registerToastHandler: vi.fn(),
}));
