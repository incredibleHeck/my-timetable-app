import React, { useMemo } from "react";
import { AlertCircle, AlertTriangle, Users } from "lucide-react";
import { Conflict } from "../../../types";

interface Props {
  conflicts: Conflict[];
  onConflictSelect?: (conflict: Conflict) => void;
}

const severityStyles = {
  HIGH: "bg-red-50/50 border-red-100 text-red-900",
  MEDIUM: "bg-orange-50/50 border-orange-100 text-orange-900",
  LOW: "bg-yellow-50/50 border-yellow-100 text-yellow-900",
};

function ConflictGroupList({
  items,
  onConflictSelect,
}: {
  items: Conflict[];
  onConflictSelect?: (conflict: Conflict) => void;
}) {
  const sortedGroups = useMemo(() => {
    const groups: Record<string, Conflict[]> = {};
    items.forEach((c) => {
      const groupKey = c.className || "System/Unresolved";
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(c);
    });

    return Object.entries(groups).sort((a, b) => {
      if (a[0] === "System/Unresolved") return -1;
      if (b[0] === "System/Unresolved") return 1;
      return a[0].localeCompare(b[0], undefined, { numeric: true });
    });
  }, [items]);

  return (
    <>
      {sortedGroups.map(([className, groupItems]) => (
        <div
          key={className}
          className="border border-slate-100 rounded-lg overflow-hidden"
        >
          <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100 flex justify-between">
            <span className="text-xs font-bold text-slate-700">{className}</span>
          </div>
          <div className="bg-white p-2 space-y-2">
            {groupItems.map((c, i) => {
              const style = severityStyles[c.severity || "HIGH"];

              return (
                <div
                  key={i}
                  className={`text-xs p-2 rounded border ${style} cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => {
                    if (
                      c.day !== 0 ||
                      c.period !== 0 ||
                      !c.reason.includes("Unplaced")
                    ) {
                      onConflictSelect?.(c);
                    }
                  }}
                >
                  <div className="flex justify-between font-semibold mb-1">
                    <span>{c.subjectName || "—"}</span>
                    <span className="text-[9px] uppercase opacity-70">
                      {c.missingPeriods
                        ? `${c.missingPeriods} Missing`
                        : c.duration === 2
                          ? "Double"
                          : "Single"}
                    </span>
                  </div>
                  {c.teacherName && (
                    <div className="opacity-75 flex items-center gap-1 mb-1">
                      <Users size={10} /> {c.teacherName}
                    </div>
                  )}
                  <p className="opacity-90 leading-snug">{c.reason}</p>
                  {c.day !== undefined && c.period !== undefined && (
                    <div className="mt-1 text-[9px] opacity-60">
                      Day {c.day + 1}, Period {c.period + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

export const ConflictPanel: React.FC<Props> = ({ conflicts, onConflictSelect }) => {
  const blocking = useMemo(
    () => conflicts.filter((c) => c.kind !== "quality"),
    [conflicts],
  );
  const quality = useMemo(
    () => conflicts.filter((c) => c.kind === "quality"),
    [conflicts],
  );

  if (conflicts.length === 0) return null;

  return (
    <div className="w-80 flex flex-col gap-3 h-fit max-h-[600px]">
      {blocking.length > 0 && (
        <div className="flex flex-col border border-red-200 bg-white rounded-xl shadow-lg overflow-hidden max-h-[400px]">
          <div className="p-3 bg-red-50 border-b border-red-100 flex justify-between items-center">
            <h3 className="font-bold text-red-800 flex items-center gap-2 text-sm">
              <AlertCircle size={16} /> Conflicts
            </h3>
            <span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {blocking.length}
            </span>
          </div>
          <div className="overflow-y-auto p-3 space-y-3 custom-scrollbar">
            <ConflictGroupList items={blocking} onConflictSelect={onConflictSelect} />
          </div>
        </div>
      )}

      {quality.length > 0 && (
        <div className="flex flex-col border border-yellow-200 bg-white rounded-xl shadow-lg overflow-hidden max-h-[300px]">
          <div className="p-3 bg-yellow-50 border-b border-yellow-100 flex justify-between items-center">
            <h3 className="font-bold text-yellow-800 flex items-center gap-2 text-sm">
              <AlertTriangle size={16} /> Quality Warnings
            </h3>
            <span className="bg-yellow-200 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {quality.length}
            </span>
          </div>
          <div className="overflow-y-auto p-3 space-y-3 custom-scrollbar">
            <ConflictGroupList items={quality} onConflictSelect={onConflictSelect} />
          </div>
        </div>
      )}
    </div>
  );
};
