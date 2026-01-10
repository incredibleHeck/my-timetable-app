import { render, screen, fireEvent } from "@testing-library/react";
import { UndoRedoControls } from "../src/components/layout/UndoRedoControls";
import { describe, it, expect, vi } from "vitest";
import { useProfile } from "../src/contexts/ProfileContext";
import React from "react";

// Minimal mock of the profile context usage
vi.mock("../src/contexts/ProfileContext", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useProfile: vi.fn(),
  };
});

describe("UndoRedoControls", () => {
  it("renders undo and redo buttons", () => {
    (useProfile as any).mockReturnValue({
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: true,
      canRedo: true,
    });

    render(<UndoRedoControls />);
    expect(screen.getByLabelText("Undo")).toBeDefined();
    expect(screen.getByLabelText("Redo")).toBeDefined();
  });

  it("disables buttons when cannot undo/redo", () => {
    (useProfile as any).mockReturnValue({
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: false,
      canRedo: false,
    });

    render(<UndoRedoControls />);
    const undoBtn = screen.getByLabelText("Undo") as HTMLButtonElement;
    const redoBtn = screen.getByLabelText("Redo") as HTMLButtonElement;
    
    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);
  });

  it("calls undo/redo on click", () => {
    const undo = vi.fn();
    const redo = vi.fn();
    (useProfile as any).mockReturnValue({
      undo,
      redo,
      canUndo: true,
      canRedo: true,
    });

    render(<UndoRedoControls />);
    fireEvent.click(screen.getByLabelText("Undo"));
    fireEvent.click(screen.getByLabelText("Redo"));

    expect(undo).toHaveBeenCalled();
    expect(redo).toHaveBeenCalled();
  });
});
