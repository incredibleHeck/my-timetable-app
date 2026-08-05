import React from "react";
import { ChevronDown } from "lucide-react";
import { AppData, PeriodType } from "../../../types";
import { controlClass } from "../../../components/ui";
import { periodTypeMeta } from "../../../utils/periodTypes";

/** A class override covers the three types a class day is built from. */
const CLASS_PERIOD_TYPES: PeriodType[] = ["CLASS", "BREAK", "LUNCH"];

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

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (val: number) => void;
}

const NumberField: React.FC<NumberFieldProps> = ({ id, label, value, onChange }) => (
  <div className="min-w-0">
    <label htmlFor={id} className="mb-1 block text-xs text-content-muted">
      {label}
    </label>
    <input
      id={id}
      type="number"
      className={`${controlClass} w-full`}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
    />
  </div>
);

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
  /**
   * Setting a type also seeds its duration the first time that type appears, so
   * a class that gains its first break does not inherit a zero length.
   */
  const setType = (idx: number, next: PeriodType) => {
    if (cStructure[idx] === next) return;
    if (!cStructure.includes(next)) {
      if (next === "BREAK") setCBreakDuration(data.settings.defaultBreakDuration || 20);
      else if (next === "LUNCH") setCLunchDuration(data.settings.defaultLunchDuration || 60);
      else if (next === "CLASS") setCDuration(data.settings.defaultClassDuration || 50);
    }
    const newStruct = [...cStructure];
    newStruct[idx] = next;
    setCStructure(newStruct);
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-content">Day structure</h4>
        <p className="mt-0.5 text-xs text-content-muted">
          Overrides the school-wide day for this class only.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          id="class-period-count"
          label="Periods/Day"
          value={cPeriodCount}
          onChange={handlePeriodCountChange}
        />
        <NumberField
          id="class-duration"
          label="Duration (min)"
          value={cDuration}
          onChange={setCDuration}
        />
        <NumberField
          id="class-break-duration"
          label="Break (min)"
          value={cBreakDuration}
          onChange={setCBreakDuration}
        />
        <NumberField
          id="class-lunch-duration"
          label="Lunch (min)"
          value={cLunchDuration}
          onChange={setCLunchDuration}
        />
      </div>

      {/* One select per period rather than a click-to-cycle tile: cycling gave no
          way back to the previous type and never announced what a tap would do. */}
      <ul className="space-y-1">
        {cStructure.map((type, idx) => {
          const meta = periodTypeMeta(type);
          const Icon = meta.icon;
          return (
            <li key={idx} className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded border text-2xs tabular-nums ${meta.block} ${meta.ink}`}
                aria-hidden
              >
                {idx + 1}
              </span>
              <div className="relative min-w-0 flex-1">
                <Icon
                  size={12}
                  className={`pointer-events-none absolute left-2.5 top-2.5 ${meta.ink}`}
                  aria-hidden
                />
                <select
                  aria-label={`Period ${idx + 1} type`}
                  value={type}
                  onChange={(e) => setType(idx, e.target.value as PeriodType)}
                  className={`${controlClass} h-8 w-full cursor-pointer appearance-none pl-7 pr-7 ${meta.ink}`}
                >
                  {CLASS_PERIOD_TYPES.map((option) => (
                    <option key={option} value={option} className="text-content">
                      {periodTypeMeta(option).label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-2.5 top-2.5 text-content-muted"
                  aria-hidden
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
