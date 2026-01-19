import React, { useMemo } from "react";
import { AlertCircle, AlertTriangle, Users } from "lucide-react";
import { Conflict } from "../../../types";

interface Props {
  conflicts: Conflict[];
  onConflictSelect?: (conflict: Conflict) => void;
}

export const ConflictPanel: React.FC<Props> = ({ conflicts, onConflictSelect }) => {
  const sortedGroups = useMemo(() => {
    const groups: Record<string, Conflict[]> = {};
    conflicts.forEach((c) => {
      const groupKey = c.className || "System/Unresolved";
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(c);
    });
    
    // Sort groups so "System/Unresolved" (which contains unplaced units) comes first
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === "System/Unresolved") return -1;
      if (b[0] === "System/Unresolved") return 1;
      return a[0].localeCompare(b[0], undefined, { numeric: true });
    });
  }, [conflicts]);

  if (conflicts.length === 0) return null;

  return (
    <div className="w-80 flex flex-col border border-red-200 bg-white rounded-xl shadow-lg overflow-hidden h-fit max-h-[600px]">
      <div className="p-3 bg-red-50 border-b border-red-100 flex justify-between items-center">
        <h3 className="font-bold text-red-800 flex items-center gap-2 text-sm">
          <AlertCircle size={16} /> Conflict Report
        </h3>
        <span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {conflicts.length}
        </span>
      </div>

      <div className="overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {sortedGroups.map(([className, items]) => (
          <div
            key={className}
            className="border border-red-100 rounded-lg overflow-hidden"
          >
            <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100 flex justify-between">
              <span className="text-xs font-bold text-slate-700">
                {className}
              </span>
            </div>
            <div className="bg-white p-2 space-y-2">
              {items.map((c, i) => {
                const severityStyles = {
                  HIGH: "bg-red-50/50 border-red-100 text-red-900",
                  MEDIUM: "bg-orange-50/50 border-orange-100 text-orange-900",
                  LOW: "bg-yellow-50/50 border-yellow-100 text-yellow-900",
                };
                const style = severityStyles[c.severity || "HIGH"];

                return (
                  <div
                    key={i}
                    className={`text-xs p-2 rounded border ${style} cursor-pointer hover:opacity-80 transition-opacity`}
                    onClick={() => {
                        // Only select if it has a valid grid position
                        if (c.day !== 0 || c.period !== 0 || !c.reason.includes("Unplaced")) {
                            onConflictSelect?.(c);
                        }
                    }}
                  >
                    <div className="flex justify-between font-semibold mb-1">
                      <span>{c.subjectName}</span>
                      <span className="text-[9px] uppercase opacity-70">
                        {c.missingPeriods 
                          ? `${c.missingPeriods} Missing` 
                          : (c.duration === 2 ? "Double" : "Single")}
                      </span>
                    </div>
                    <div className="opacity-75 flex items-center gap-1 mb-1">
                      <Users size={10} /> {c.teacherName}
                    </div>
                    <div className="italic text-[10px] opacity-90 leading-tight">
                      {c.reason}
                    </div>
                    {(c.day !== 0 || c.period !== 0) && !c.reason.includes("Unplaced") && (
                        <div className="mt-1 text-[8px] font-bold uppercase tracking-tighter opacity-50">
                            Day {c.day + 1} • Period {c.period + 1}
                        </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
