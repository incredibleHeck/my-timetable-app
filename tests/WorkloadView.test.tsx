import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkloadView } from "../src/features/workload/WorkloadView";
import { DEFAULT_DATA } from "../src/utils/constants";

describe("WorkloadView Component", () => {
  const sampleData = {
    ...DEFAULT_DATA,
    teachers: [
      { id: "t1", name: "Alice Teacher", specialtyIds: ["s1"], constraints: [] },
      { id: "t2", name: "Bob Instructor", specialtyIds: ["s2"], constraints: [] },
    ],
  };

  it("renders workload analysis header and capacity tab by default", () => {
    render(<WorkloadView data={sampleData} onUpdate={vi.fn()} />);

    expect(screen.getByText("Workload Analysis")).toBeInTheDocument();
    expect(screen.getByText("Alice Teacher")).toBeInTheDocument();
    expect(screen.getByText("Bob Instructor")).toBeInTheDocument();
  });

  it("filters teachers when typing in the search box", async () => {
    const user = userEvent.setup();
    render(<WorkloadView data={sampleData} onUpdate={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/search by name/i);
    await user.type(searchInput, "Alice");

    expect(screen.getByText("Alice Teacher")).toBeInTheDocument();
    expect(screen.queryByText("Bob Instructor")).not.toBeInTheDocument();
  });

  it("switches to analytics tab when selected", async () => {
    const user = userEvent.setup();
    render(<WorkloadView data={sampleData} onUpdate={vi.fn()} />);

    const analyticsTab = screen.getByRole("tab", { name: "Analytics" });
    await user.click(analyticsTab);

    expect(screen.getByText(/no timetable to analyse/i)).toBeInTheDocument();
  });
});
