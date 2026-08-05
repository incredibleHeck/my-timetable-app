import React from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { ViewState } from "../../../types";

interface ConfigImpactBannerProps {
  conflictCount: number;
  onNavigate?: (view: ViewState) => void;
}

/**
 * Standing notice, not an alert: the conflicts already exist, this screen just
 * has to say that editing rules will move them around.
 */
export const ConfigImpactBanner: React.FC<ConfigImpactBannerProps> = ({
  conflictCount,
  onNavigate,
}) => {
  if (conflictCount <= 0) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-edge border-l-2 border-l-accent bg-surface px-4 py-2.5"
    >
      <AlertTriangle className="shrink-0 text-accent-ink" size={15} aria-hidden />
      <p className="text-xs text-content-secondary">
        <span className="font-medium text-content">
          {conflictCount} unresolved conflict{conflictCount === 1 ? "" : "s"}
        </span>{" "}
        in the current timetable. Editing rules or the day structure will change which assignments
        remain valid.
      </p>
      {onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate("GENERATOR")}
          className="ml-auto inline-flex items-center gap-1 rounded text-xs font-medium text-accent-ink
                     underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Open generator
          <ArrowRight size={13} aria-hidden />
        </button>
      )}
    </div>
  );
};
