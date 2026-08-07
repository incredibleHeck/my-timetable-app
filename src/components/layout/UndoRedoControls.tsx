import React, { useEffect } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useHistory } from "../../contexts/HistoryContext";

export const UndoRedoControls: React.FC = () => {
  const { undo, redo, canUndo, canRedo } = useHistory();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isZ = e.key.toLowerCase() === "z";
      const isY = e.key.toLowerCase() === "y";
      const isMod = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      if (isMod && isZ && !isShift) {
        e.preventDefault();
        undo();
      } else if ((isMod && isY) || (isMod && isShift && isZ)) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const button =
    "grid h-8 w-8 place-items-center rounded-md text-content-muted transition-colors " +
    "hover:bg-surface-inset hover:text-content disabled:pointer-events-none disabled:opacity-40 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        className={button}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={16} aria-hidden />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        className={button}
        aria-label="Redo"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 size={16} aria-hidden />
      </button>
    </div>
  );
};
