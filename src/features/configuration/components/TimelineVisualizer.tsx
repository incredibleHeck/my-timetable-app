import React, { useMemo } from "react";
import { School, Coffee, Utensils, Users, Clock } from "lucide-react";
import { AppData, PeriodType } from "../../../types";
import { timeToMinutes } from "../../../utils/timeUtils";

const TYPE_ICONS: Record<PeriodType, React.ReactNode> = {
  CLASS: <School size={14} className="shrink-0" aria-hidden />,
  BREAK: <Coffee size={14} className="shrink-0" aria-hidden />,
  LUNCH: <Utensils size={14} className="shrink-0" aria-hidden />,
  ASSEMBLY: <Users size={14} className="shrink-0" aria-hidden />,
};

const TYPE_STYLES: Record<PeriodType, { bg: string; border: string; text: string; dot: string }> = {
  CLASS: {
    bg: "bg-blue-50/80 hover:bg-blue-100/90",
    border: "border-blue-200 hover:border-blue-400",
    text: "text-blue-800",
    dot: "bg-blue-500",
  },
  BREAK: {
    bg: "bg-amber-50/80 hover:bg-amber-100/90",
    border: "border-amber-200 hover:border-amber-400",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  LUNCH: {
    bg: "bg-orange-50/80 hover:bg-orange-100/90",
    border: "border-orange-200 hover:border-orange-400",
    text: "text-orange-800",
    dot: "bg-orange-500",
  },
  ASSEMBLY: {
    bg: "bg-violet-50/80 hover:bg-violet-100/90",
    border: "border-violet-200 hover:border-violet-400",
    text: "text-violet-800",
    dot: "bg-violet-500",
  },
};

interface TimelineVisualizerProps {
  data: AppData;
}

export const TimelineVisualizer: React.FC<TimelineVisualizerProps> = ({ data }) => {
  const { dayStructure, timeSlots } = data.settings;

  const timelineBlocks = useMemo(() => {
    if (!dayStructure || !timeSlots || dayStructure.length === 0 || timeSlots.length === 0) {
      return [];
    }

    const blocks = dayStructure.map((period, index) => {
      const slot = timeSlots[index];
      const start = slot?.start || "08:00";
      const end = slot?.end || "09:00";
      const startMin = timeToMinutes(start);
      const endMin = timeToMinutes(end);
      const duration = Math.max(0, endMin - startMin);

      return {
        ...period,
        start,
        end,
        startMin,
        endMin,
        duration,
        index,
      };
    });

    const dayStart = Math.min(...blocks.map((b) => b.startMin));
    const dayEnd = Math.max(...blocks.map((b) => b.endMin));
    const totalDuration = Math.max(1, dayEnd - dayStart);

    return blocks.map((b) => ({
      ...b,
      widthPercent: (b.duration / totalDuration) * 100,
    }));
  }, [dayStructure, timeSlots]);

  if (timelineBlocks.length === 0) {
    return null;
  }

  const firstBlock = timelineBlocks[0];
  const lastBlock = timelineBlocks[timelineBlocks.length - 1];

  return (
    <div className="w-full space-y-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-bold text-content-muted uppercase tracking-wide flex items-center gap-1.5">
          <Clock size={14} className="text-amber-500" />
          Proportional Day Timeline
        </h4>
        <div className="text-2xs text-slate-400 font-medium">
          Start: <strong className="text-slate-700 dark:text-slate-200">{firstBlock.start}</strong>{" "}
          &bull; End:{" "}
          <strong className="text-slate-700 dark:text-slate-200">{lastBlock.end}</strong>
        </div>
      </div>

      {/* The Timeline Bar */}
      <div className="flex w-full h-14 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1 gap-1">
        {timelineBlocks.map((block) => {
          const style = TYPE_STYLES[block.type] || TYPE_STYLES.CLASS;
          const width = `${block.widthPercent}%`;

          return (
            <div
              key={block.index}
              style={{ width }}
              className={`group relative flex flex-col justify-center px-2 py-1 rounded-md border ${style.bg} ${style.border} transition-all duration-200 cursor-help select-none`}
            >
              <div className="flex items-center gap-1 min-w-0">
                <span className={`${style.text}`}>{TYPE_ICONS[block.type]}</span>
                <span className={`text-2xs font-bold truncate ${style.text}`}>
                  {block.label || `Block ${block.index + 1}`}
                </span>
              </div>
              <span className="text-2xs opacity-70 font-semibold truncate leading-none mt-0.5 text-content-muted">
                {block.start} - {block.end}
              </span>

              {/* Advanced Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-30 bg-slate-900 text-white text-[11px] rounded-lg p-2.5 shadow-xl leading-normal border border-slate-800">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span className="font-bold text-slate-200">{block.label}</span>
                </div>
                <div className="space-y-0.5 text-slate-400 font-medium">
                  <div>
                    Type:{" "}
                    <span className="text-slate-200 uppercase font-semibold text-2xs">
                      {block.type}
                    </span>
                  </div>
                  <div>
                    Time Slot:{" "}
                    <span className="text-slate-200">
                      {block.start} - {block.end}
                    </span>
                  </div>
                  <div>
                    Duration: <span className="text-slate-200">{block.duration} minutes</span>
                  </div>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-1 justify-center sm:justify-start">
        {(Object.keys(TYPE_STYLES) as PeriodType[]).map((type) => {
          const style = TYPE_STYLES[type];
          return (
            <div
              key={type}
              className="flex items-center gap-1.5 text-2xs font-semibold text-content-muted"
            >
              <span className={`w-2.5 h-2.5 rounded-sm border ${style.bg} ${style.border}`} />
              <span className="capitalize">{type.toLowerCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
