import React, { useMemo } from "react";
import { AlertCircle, AlertTriangle, Users } from "lucide-react";
import { Conflict } from "../../../types";

interface Props {
  conflicts: Conflict[];
}

export const ConflictPanel: React.FC<Props> = ({ conflicts }) => {
  const sortedGroups = useMemo(() => {
    const groups: Record<string, Conflict[]> = {};
    conflicts.forEach((c) => {
      if (!groups[c.className]) groups[c.className] = [];
      groups[c.className].push(c);
    });
    return Object.entries(groups).sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true })
    );
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
              {items.map((c, i) => (
                <div
                  key={i}
                  className="text-xs p-2 bg-red-50/50 rounded border border-red-50"
                >
                  <div className="flex justify-between font-semibold text-red-900 mb-1">
                    <span>{c.subjectName}</span>
                    <span className="text-[9px] uppercase opacity-70">
                      {c.duration === 2 ? "Double" : "Single"}
                    </span>
                  </div>
                  <div className="text-slate-500 flex items-center gap-1 mb-1">
                    <Users size={10} /> {c.teacherName}
                  </div>
                  <div className="text-red-500 italic text-[10px]">
                    {c.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
