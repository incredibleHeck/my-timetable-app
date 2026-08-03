import React from "react";
import { School, Coffee, Utensils } from "lucide-react";
import { AppData, PeriodType } from "../../../types";
import { Input } from "../../../components/ui";

interface ClassStructureSectionProps {
  data: AppData;
  cPeriodCount: number;
  handlePeriodCountChange: (val: number) => void;
  cDuration: number;
  setCDuration: (val: number) => void;
  cBreakDuration: number;
  setCBreakDuration: (val: number) => void;
  cLunchDuration: number;
  setCLunchDuration: (val: number) => void;
  cStructure: PeriodType[];
  setCStructure: (struct: PeriodType[]) => void;
}

export const ClassStructureSection: React.FC<ClassStructureSectionProps> = ({
  data,
  cPeriodCount,
  handlePeriodCountChange,
  cDuration,
  setCDuration,
  cBreakDuration,
  setCBreakDuration,
  cLunchDuration,
  setCLunchDuration,
  cStructure,
  setCStructure,
}) => {
  const renderStructureTimingInputs = () => (
    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
      <Input
        label="Periods/Day"
        type="number"
        value={cPeriodCount}
        onChange={(e) => handlePeriodCountChange(parseInt(e.target.value) || 0)}
      />
      <Input
        label="Duration (min)"
        type="number"
        value={cDuration}
        onChange={(e) => setCDuration(parseInt(e.target.value) || 0)}
      />
      <Input
        label="Break (min)"
        type="number"
        value={cBreakDuration}
        onChange={(e) => setCBreakDuration(parseInt(e.target.value) || 0)}
      />
      <Input
        label="Lunch (min)"
        type="number"
        value={cLunchDuration}
        onChange={(e) => setCLunchDuration(parseInt(e.target.value) || 0)}
      />
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in">
      <p className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 p-3 rounded border border-blue-100">
        <span className="font-bold">Instructions:</span> Click any block below to toggle it between{" "}
        <b>Class</b>, <b>Break</b>, or <b>Lunch</b>. This overrides the global schedule for this
        specific class only.
      </p>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {cStructure.map((type, idx) => (
          <button
            key={idx}
            onClick={() => {
              const types: PeriodType[] = ["CLASS", "BREAK", "LUNCH"];
              const next = types[(types.indexOf(type) + 1) % 3];
              const newStruct = [...cStructure];
              newStruct[idx] = next;

              // Auto-update duration if it's the first slot of this type
              const isFirstOfType = !cStructure.includes(next);
              if (isFirstOfType) {
                if (next === "BREAK") {
                  setCBreakDuration(data.settings.defaultBreakDuration || 20);
                } else if (next === "LUNCH") {
                  setCLunchDuration(data.settings.defaultLunchDuration || 60);
                } else if (next === "CLASS") {
                  setCDuration(data.settings.defaultClassDuration || 50);
                }
              }

              setCStructure(newStruct);
            }}
            className={`
                      p-3 rounded-lg border text-center text-xs font-bold transition-all relative overflow-hidden group
                      ${
                        type === "CLASS"
                          ? "bg-white dark:bg-slate-800 border-slate-300 text-slate-700 dark:text-slate-200 hover:border-blue-400"
                          : ""
                      }
                      ${type === "BREAK" ? "bg-amber-50 border-amber-300 text-amber-700" : ""}
                      ${type === "LUNCH" ? "bg-orange-50 border-orange-300 text-orange-700" : ""}
                  `}
          >
            <div className="absolute top-1 left-1 text-[9px] text-slate-400 font-normal opacity-50">
              {idx + 1}
            </div>
            <div className="mt-1">
              {type === "CLASS" && <School size={16} className="mx-auto mb-1" />}
              {type === "BREAK" && <Coffee size={16} className="mx-auto mb-1" />}
              {type === "LUNCH" && <Utensils size={16} className="mx-auto mb-1" />}
              {type || "CLASS"}
            </div>
          </button>
        ))}
      </div>
      {renderStructureTimingInputs()}
    </div>
  );
};
