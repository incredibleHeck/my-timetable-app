import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui";
import { ViewState } from "../../../types";

interface ConfigImpactBannerProps {
  conflictCount: number;
  onNavigate?: (view: ViewState) => void;
}

export const ConfigImpactBanner: React.FC<ConfigImpactBannerProps> = ({
  conflictCount,
  onNavigate,
}) => {
  if (conflictCount <= 0) return null;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50"
      role="status"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} aria-hidden />
        <div>
          <p className="text-sm font-bold text-amber-900">
            {conflictCount} scheduling conflict{conflictCount === 1 ? "" : "s"} detected
          </p>
          <p className="text-xs text-amber-800/80 mt-0.5">
            Rule or structure changes may affect existing timetables. Review assignments in the
            generator.
          </p>
        </div>
      </div>
      {onNavigate && (
        <Button
          variant="secondary"
          className="shrink-0 border-amber-300 text-amber-900 hover:bg-amber-100"
          onClick={() => onNavigate("GENERATOR")}
        >
          Review in Generator
        </Button>
      )}
    </div>
  );
};
