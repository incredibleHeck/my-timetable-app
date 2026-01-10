import { render, screen } from "@testing-library/react";
import { SidebarSection } from "../src/components/layout/Sidebar";
import { describe, it, expect } from "vitest";

describe("SidebarSection", () => {
  it("renders the label in uppercase", () => {
    render(<SidebarSection label="Academic Data" />);
    const element = screen.getByText("ACADEMIC DATA");
    expect(element).toBeDefined();
    expect(element.className).toContain("uppercase");
  });

  it("applies top margin when not the first section", () => {
    const { container } = render(
      <>
        <SidebarSection label="Section 1" isFirst />
        <SidebarSection label="Section 2" />
      </>
    );
    
    const sections = container.querySelectorAll("div");
    expect(sections[0].className).not.toContain("mt-");
    expect(sections[1].className).toContain("mt-");
  });
});
