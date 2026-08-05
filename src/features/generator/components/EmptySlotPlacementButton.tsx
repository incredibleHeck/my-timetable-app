import React from "react";
import { Plus } from "lucide-react";

interface Props {
  onClick: () => void;
}

/**
 * Offered on an empty slot only when the class has lessons the solver could not
 * place, so it no longer needs a state for "nothing to put here".
 */
export const EmptySlotPlacementButton: React.FC<Props> = ({ onClick }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title="Place an unplaced lesson here"
    aria-label="Place an unplaced lesson here"
    className="grid h-full w-full place-items-center rounded-md border border-dashed border-edge-strong
               text-content-muted transition-colors hover:border-accent hover:text-accent-ink
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
               focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
  >
    <Plus size={15} aria-hidden />
  </button>
);
