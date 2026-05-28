import { render, screen, fireEvent } from "@testing-library/react";
import { UndoRedoControls } from "../src/components/layout/UndoRedoControls";
import { describe, it, expect, vi } from "vitest";
import { useHistory } from "../src/contexts/HistoryContext";

vi.mock("../src/contexts/HistoryContext", () => ({
  useHistory: vi.fn(),
}));

describe("UndoRedoControls", () => {
  it("renders undo and redo buttons", () => {
    (useHistory as ReturnType<typeof vi.fn>).mockReturnValue({
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
    (useHistory as ReturnType<typeof vi.fn>).mockReturnValue({
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
    (useHistory as ReturnType<typeof vi.fn>).mockReturnValue({
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
