import React from "react";
import { AppData } from "../../../types";
import { DAYS } from "../../../utils/constants";

interface ReservationsGridSectionProps {
  data: AppData;
  handleSlotClick: (dIdx: number, pIdx: number) => void;
}

export const ReservationsGridSection: React.FC<ReservationsGridSectionProps> = ({
  data,
  handleSlotClick,
}) => {
  const { periodsPerDay, dayStructure, fixedOccasions } = data.settings;

  return (
    <div className="mt-10">
      <div className="flex justify-between items-end mb-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          Global Reservations (Fixed Slots)
        </p>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-xl p-6 bg-slate-50 shadow-inner custom-scrollbar">
        <div
          className="grid gap-2 min-w-[900px]"
          style={{
            gridTemplateColumns: `100px repeat(${periodsPerDay}, minmax(80px, 1fr))`,
          }}
        >
          {/* Header Row */}
          <div className="text-xs font-bold text-slate-400 uppercase text-right pr-4 py-2 self-end">
            Day
          </div>
          {dayStructure.map((p, i) => (
            <div key={i} className="text-center p-2 bg-white rounded-t-lg border-x border-t border-slate-100 shadow-sm">
              <div className="text-[10px] font-bold text-amber-600 mb-1">P{i + 1}</div>
              <div className="text-[9px] font-bold text-slate-700 truncate px-1 uppercase tracking-tighter">
                {p.label}
              </div>
            </div>
          ))}

          {/* Day Rows */}
          {DAYS.map((day, dIdx) => (
            <React.Fragment key={day}>
              <div className="text-xs font-black text-slate-800 text-right pr-6 py-4 self-center uppercase tracking-widest border-r-2 border-slate-200">
                {day.substring(0, 3)}
              </div>
              {Array.from({ length: periodsPerDay }).map((_, pIdx) => {
                let occasionName: any = fixedOccasions[dIdx]?.[pIdx];
                if (occasionName === true) occasionName = "Reserved";
                return (
                  <button
                    key={`${dIdx}-${pIdx}`}
                    onClick={() => handleSlotClick(dIdx, pIdx)}
                    className={`
                      h-16 rounded-lg transition-all duration-200 border-2 flex flex-col items-center justify-center px-2 text-[10px] leading-tight overflow-hidden break-words relative group shadow-sm
                      ${
                        occasionName
                          ? "bg-slate-800 border-slate-900 text-amber-400 font-bold scale-[1.02] z-10 shadow-md"
                          : "bg-white border-slate-100 hover:border-amber-400 hover:shadow-md text-slate-300 hover:scale-[1.02] hover:z-10"
                      }
                    `}
                  >
                    {occasionName ? (
                      <span className="z-10 text-center animate-in fade-in zoom-in-95 duration-300">
                        {occasionName}
                      </span>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100 font-bold text-lg">+</span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-2 text-center italic">
        Tip: You can scroll horizontally if you have many periods.
      </p>
    </div>
  );
};
