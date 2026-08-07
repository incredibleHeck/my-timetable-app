import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Header } from "../src/components/layout/Header";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { ViewState } from "../src/types";

// Mock UndoRedoControls as it depends on ProfileContext
vi.mock("../src/components/layout/UndoRedoControls", () => ({
  UndoRedoControls: () => <div data-testid="undo-redo">UndoRedo</div>,
}));

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("Header", () => {
  const defaultProps = {
    view: "DASHBOARD" as ViewState,
    activeProfile: { id: "p1", name: "Profile 1" },
    profiles: [
      { id: "p1", name: "Profile 1" },
      { id: "p2", name: "Profile 2" },
    ],
    autoSaveStatus: "SAVED" as "SAVED" | "SAVING",
    onSwitchProfile: vi.fn(),
  };

  it("renders the correct title based on view", () => {
    render(<Header {...defaultProps} />, { wrapper: Providers });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders the active profile name", () => {
    render(<Header {...defaultProps} />, { wrapper: Providers });
    expect(screen.getByText("Profile 1")).toBeInTheDocument();
  });

  it("displays saving status when autoSaveStatus is SAVING", () => {
    render(<Header {...defaultProps} autoSaveStatus="SAVING" />, { wrapper: Providers });
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("opens profile menu and calls onSwitchProfile when a profile is selected", () => {
    render(<Header {...defaultProps} />, { wrapper: Providers });

    // Click to open menu
    fireEvent.click(screen.getByText("Profile 1"));

    // Check if Profile 2 is now visible in the dropdown
    const profile2Button = screen.getByText("Profile 2");
    expect(profile2Button).toBeInTheDocument();

    // Click Profile 2
    fireEvent.click(profile2Button);

    expect(defaultProps.onSwitchProfile).toHaveBeenCalledWith("p2");
  });
});
