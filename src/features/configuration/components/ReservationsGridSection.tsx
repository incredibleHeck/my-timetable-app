import React from "react";
import { AppData, PeriodType } from "../../../types";
import { DAYS } from "../../../utils/constants";
import { getOccasionLabel } from "../../../utils/utils";

interface ReservationsGridSectionProps {
  data: AppData;
  handleSlotClick: (dIdx: number, pIdx: number) => void;
}

const headerClassByType = (type: PeriodType): string => {
  switch (type) {
    case "BREAK":
      return "bg-amber-50 border-amber-200";
    case "LUNCH":
      return "bg-orange-50 border-orange-200";
    case "ASSEMBLY":
      return "bg-violet-50 border-violet-200";
    default:
      return "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700";
  }
};

export const ReservationsGridSection: React.FC<ReservationsGridSectionProps> = ({
  data,
  handleSlotClick,
}) => {
  const { periodsPerDay, dayStructure, fixedOccasions } = data.settings;

  return (
    <div className="mt-2">
      <div className="flex justify-between items-end mb-3">
        <p className="text-xs font-bold text-content-muted uppercase tracking-wide">
          Global Reservations (Fixed Slots)
        </p>
      </div>
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-slate-50 dark:bg-slate-900 shadow-inner custom-scrollbar">
        <div
          className="grid gap-2 min-w-[900px]"
          style={{
            gridTemplateColumns: `100px repeat(${periodsPerDay}, minmax(80px, 1fr))`,
          }}
        >
          <div className="text-xs font-bold text-content-muted uppercase text-right pr-4 py-2 self-end sticky left-0 z-20 bg-slate-50 dark:bg-slate-900">
            Day
          </div>
          {dayStructure.map((p, i) => (
            <div
              key={i}
              className={`text-center p-2 rounded-t-lg border-x border-t shadow-sm ${headerClassByType(p.type)}`}
            >
              <div className="text-2xs font-bold text-accent-ink mb-1">P{i + 1}</div>
              <div className="text-2xs font-bold text-slate-700 dark:text-slate-200 truncate px-1 uppercase tracking-tighter">
                {p.label}
              </div>
            </div>
          ))}

          {DAYS.map((day, dIdx) => (
            <React.Fragment key={day}>
              <div className="text-xs font-black text-slate-800 dark:text-slate-100 text-right pr-6 py-4 self-center uppercase tracking-widest border-r-2 border-slate-200 dark:border-slate-700 sticky left-0 z-10 bg-slate-50 dark:bg-slate-900">
                {day.substring(0, 3)}
              </div>
              {Array.from({ length: periodsPerDay }).map((_, pIdx) => {
                const occasionName = getOccasionLabel(fixedOccasions[dIdx]?.[pIdx]);
                return (
                  <button
                    key={`${dIdx}-${pIdx}`}
                    type="button"
                    aria-label={
                      occasionName
                        ? `Edit ${occasionName} on ${day} period ${pIdx + 1}`
                        : `Set fixed event on ${day} period ${pIdx + 1}`
                    }
                    onClick={() => handleSlotClick(dIdx, pIdx)}
                    className={`
                      h-16 rounded-lg transition-all duration-200 border-2 flex flex-col items-center justify-center px-2 text-2xs leading-tight overflow-hidden break-words relative group shadow-sm
                      ${
                        occasionName
                          ? "bg-slate-800 border-slate-900 text-amber-400 font-bold scale-[1.02] z-10 shadow-md"
                          : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-amber-400 hover:shadow-md text-content-muted hover:scale-[1.02] hover:z-10"
                      }
                    `}
                  >
                    {occasionName ? (
                      <span className="z-10 text-center">{occasionName}</span>
                    ) : (
                      <>
                        <span className="font-bold text-slate-300 group-hover:hidden">Set</span>
                        <span className="hidden group-hover:inline font-bold text-lg text-accent-ink">
                          +
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <p className="text-2xs text-content-muted mt-2 text-center italic">
        Tip: Scroll horizontally if you have many periods. The day column stays visible.
      </p>
    </div>
  );
};
