import React from "react";
import { Plus } from "lucide-react";

interface Props {
  onClick: () => void;
  hasPending: boolean;
}

export const EmptySlotPlacementButton: React.FC<Props> = ({ onClick, hasPending }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex flex-col items-center justify-center w-full h-full rounded-md border-2 border-dashed transition-all group ${
        hasPending
          ? "border-amber-300 bg-amber-50/40 hover:border-amber-400 hover:bg-amber-50"
          : "border-slate-200 dark:border-slate-700 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50"
      }`}
      title={hasPending ? "Assign an unplaced lesson here" : "No unplaced lessons for this class"}
    >
      <div
        className={`p-1.5 rounded-full transition-colors ${
          hasPending
            ? "bg-amber-100 text-accent-ink group-hover:bg-amber-200"
            : "bg-slate-100 dark:bg-slate-800 text-content-muted group-hover:bg-slate-200"
        }`}
      >
        <Plus size={16} strokeWidth={2.5} />
      </div>
      {hasPending && (
        <span className="text-2xs font-bold text-amber-700/80 mt-1 uppercase tracking-wide">
          Assign
        </span>
      )}
    </button>
  );
};
