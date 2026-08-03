import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "../src/components/layout/Sidebar";
import { I18nProvider } from "../src/contexts/I18nContext";
import { ViewState } from "../src/types";

const Providers = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

describe("Sidebar", () => {
  const defaultProps = {
    view: "DASHBOARD" as ViewState,
    setView: vi.fn(),
    onSave: vi.fn(),
    hasUnsavedChanges: false,
    activeFilePath: null,
    activeProfile: { id: "p1", name: "Active P" },
    profiles: [
      { id: "p1", name: "Active P" },
      { id: "p2", name: "Other P" },
    ],
    onSwitchProfile: vi.fn(),
  };

  it("should render profiles", () => {
    render(<Sidebar {...defaultProps} />, { wrapper: Providers });

    // Check for profiles section or items
    // Assuming we add a "Profiles" header or just list them
    expect(screen.getByText("Active P")).toBeInTheDocument();

    // Check switch
    // Depending on implementation, might need to expand a menu?
    // If list is always visible:
    // fireEvent.click(screen.getByText('Other P'));
    // expect(defaultProps.onSwitchProfile).toHaveBeenCalledWith('p2');
  });
});
