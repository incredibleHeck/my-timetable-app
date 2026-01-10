import React, { useEffect } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useProfile } from "../../contexts/ProfileContext";

export const UndoRedoControls: React.FC = () => {
  const { undo, redo, canUndo, canRedo } = useProfile();

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

  return (
    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
      <button
        onClick={undo}
        disabled={!canUndo}
        className={`p-1.5 rounded-md transition-all ${
          canUndo
            ? "text-slate-700 hover:bg-white hover:shadow-sm active:scale-95"
            : "text-slate-300 cursor-not-allowed opacity-50"
        }`}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className={`p-1.5 rounded-md transition-all ${
          canRedo
            ? "text-slate-700 hover:bg-white hover:shadow-sm active:scale-95"
            : "text-slate-300 cursor-not-allowed opacity-50"
        }`}
        aria-label="Redo"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 size={16} />
      </button>
    </div>
  );
};
