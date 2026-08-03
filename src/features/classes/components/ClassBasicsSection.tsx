import React from "react";
import { School } from "lucide-react";
import { AppData, FixedOccasion } from "../../../types";
import { ClassGroup } from "../types";
import { Input } from "../../../components/ui";
import { getOccasionLabel } from "../../../utils/utils";
import { DAYS } from "../../../utils/constants";

interface ClassBasicsSectionProps {
  data: AppData;
  editingClass: ClassGroup | null;
  cName: string;
  setCName: (name: string) => void;
  cPeriodCount: number;
  cFixedSessions: FixedOccasion[][];
  setSlotLabel: (label: string) => void;
  setActiveSlot: (slot: { d: number; p: number } | null) => void;
}

export const ClassBasicsSection: React.FC<ClassBasicsSectionProps> = ({
  data,
  editingClass,
  cName,
  setCName,
  cPeriodCount,
  cFixedSessions,
  setSlotLabel,
  setActiveSlot,
}) => {
  return (
    <div className="space-y-6">
      <Input
        label="Class Name"
        value={cName}
        onChange={(e) => setCName(e.target.value)}
        placeholder="e.g. Grade 10A"
        autoFocus
      />

      <div className="space-y-2">
        <label className="block text-xs font-bold text-content-muted uppercase">
          Home Classroom
        </label>
        <div className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm p-2 text-slate-600 dark:text-slate-300 font-medium flex items-center gap-2 italic">
          <School size={14} className="text-amber-500" />
          {editingClass
            ? data.rooms.find((r) => r.id === editingClass.defaultRoomId)?.name ||
              `${cName} Classroom`
            : `${cName || "New Class"} Classroom`}
        </div>
        <p className="text-2xs text-slate-400 italic">
          The Home Room is automatically generated and managed by the system.
        </p>
      </div>

      {/* RESERVATIONS GRID */}
      <div>
        <div className="flex justify-between items-end mb-2">
          <label className="block text-xs font-bold text-content-muted uppercase">
            Class-Specific Events
          </label>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-slate-50 dark:bg-slate-900 shadow-inner">
          <div
            className="grid gap-1 min-w-max"
            style={{
              gridTemplateColumns: `40px repeat(${cPeriodCount}, 1fr)`,
            }}
          >
            {/* Header */}
            <div className="text-right pr-2 text-2xs font-bold text-slate-400 self-end pb-1">
              Day
            </div>
            {Array.from({ length: cPeriodCount }).map((_, i) => (
              <div key={i} className="text-center text-2xs font-bold text-slate-400">
                P{i + 1}
              </div>
            ))}

            {/* Body */}
            {DAYS.map((d, dIdx) => (
              <React.Fragment key={d}>
                <div className="text-right text-2xs font-bold text-slate-600 dark:text-slate-300 pr-2 uppercase self-center">
                  {d.substring(0, 3)}
                </div>
                {Array.from({ length: cPeriodCount }).map((_, pIdx) => {
                  // Check Global First
                  const globalLabel = getOccasionLabel(data.settings.fixedOccasions[dIdx]?.[pIdx]);

                  // Check Local
                  const localLabel = getOccasionLabel(cFixedSessions[dIdx]?.[pIdx]);
                  const displayLabel = localLabel || globalLabel;
                  const isGlobal = !!globalLabel;

                  return (
                    <button
                      key={pIdx}
                      onClick={() => {
                        if (isGlobal) return;
                        setSlotLabel(localLabel || "");
                        setActiveSlot({ d: dIdx, p: pIdx });
                      }}
                      disabled={isGlobal}
                      title={displayLabel || "Available"}
                      className={`
                                              h-6 rounded border text-2xs font-bold truncate px-0.5 transition-all
                                              ${
                                                isGlobal
                                                  ? "bg-slate-200 dark:bg-slate-700 text-content-muted border-slate-300 cursor-not-allowed"
                                                  : localLabel
                                                    ? "bg-amber-100 text-amber-700 border-amber-300"
                                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-400"
                                              }
                                          `}
                    >
                      {displayLabel ? displayLabel.substring(0, 4) : "+"}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <p className="text-2xs text-slate-400 mt-2">
          Grey = Global Event (Locked). Amber = Class Event.
        </p>
      </div>
    </div>
  );
};
