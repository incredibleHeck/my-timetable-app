import React from "react";
import { Ban } from "lucide-react";
import { AppData } from "../../../types";
import { DAYS } from "../../../utils/constants";
import { periodTypeMeta } from "../../../utils/periodTypes";
import { quietButtonClass } from "../../../components/ui";

export type AvailabilityTemplate = "MORNINGS" | "AFTERNOONS" | "FRIDAYS" | "CLEAR";

const TEMPLATES: { id: AvailabilityTemplate; label: string }[] = [
  { id: "MORNINGS", label: "Mornings only" },
  { id: "AFTERNOONS", label: "Afternoons only" },
  { id: "FRIDAYS", label: "No Fridays" },
  { id: "CLEAR", label: "Clear all" },
];

interface AvailabilityGridProps {
  data: AppData;
  periodCount: number;
  /** `[day][period]`, true = the teacher cannot be scheduled. */
  constraints: boolean[][];
  onToggleSlot: (day: number, period: number) => void;
  onToggleDay: (day: number) => void;
  onApplyTemplate: (template: AvailabilityTemplate) => void;
}

/**
 * Week grid of blocked slots. Blocked is the exception, so it is the only state
 * that gets a fill — the previous grid painted blocked cells solid red with a
 * white icon, which made a teacher with a light restriction look alarming and
 * buried the break columns it was competing with.
 */
export const AvailabilityGrid: React.FC<AvailabilityGridProps> = ({
  data,
  periodCount,
  constraints,
  onToggleSlot,
  onToggleDay,
  onApplyTemplate,
}) => {
  const blockedCount = constraints.reduce((total, row) => total + row.filter(Boolean).length, 0);
  const totalSlots = DAYS.length * periodCount;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div>
          <h4 className="text-sm font-medium text-content">Availability</h4>
          <p className="mt-0.5 text-xs text-content-muted">
            {blockedCount === 0
              ? "Available for every period. Select a slot to block it."
              : `${blockedCount} of ${totalSlots} slots blocked. Select a day name to toggle the whole row.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onApplyTemplate(template.id)}
              className={`${quietButtonClass} h-7 px-2 text-xs`}
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-edge">
        <div
          className="grid min-w-max gap-1 p-3"
          style={{ gridTemplateColumns: `3rem repeat(${periodCount}, minmax(2.5rem, 1fr))` }}
        >
          <div aria-hidden />
          {Array.from({ length: periodCount }).map((_, i) => {
            const config = data.settings.dayStructure[i];
            const meta = config ? periodTypeMeta(config.type) : null;
            const isTeaching = !config || config.type === "CLASS" || config.type === "ASSEMBLY";
            return (
              <div
                key={i}
                title={config?.label}
                className={`truncate px-1 pb-1 text-center text-2xs ${
                  isTeaching ? "text-content-muted" : (meta?.ink ?? "text-content-muted")
                }`}
              >
                {config?.label || i + 1}
              </div>
            );
          })}

          {DAYS.map((day, dIdx) => (
            <React.Fragment key={day}>
              <button
                type="button"
                onClick={() => onToggleDay(dIdx)}
                aria-label={`Toggle every period on ${day}`}
                className="flex h-9 items-center rounded pr-2 text-xs font-medium text-content-secondary
                           transition-colors hover:text-accent-ink focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-accent"
              >
                {day.slice(0, 3)}
              </button>
              {Array.from({ length: periodCount }).map((_, pIdx) => {
                const isBlocked = Boolean(constraints[dIdx]?.[pIdx]);
                const type = data.settings.dayStructure[pIdx]?.type;
                const isNonTeaching = type === "BREAK" || type === "LUNCH";

                return (
                  <button
                    key={pIdx}
                    type="button"
                    aria-pressed={isBlocked}
                    aria-label={`${day} ${data.settings.dayStructure[pIdx]?.label || `period ${pIdx + 1}`}: ${
                      isBlocked ? "blocked" : "available"
                    }`}
                    onClick={() => onToggleSlot(dIdx, pIdx)}
                    className={`grid h-9 place-items-center rounded border transition-colors
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                                focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
                                  isBlocked
                                    ? "border-danger/40 bg-danger/15"
                                    : isNonTeaching
                                      ? "border-dashed border-edge-strong bg-canvas hover:border-accent"
                                      : "border-edge bg-canvas hover:border-edge-strong"
                                }`}
                  >
                    {isBlocked && <Ban size={13} className="text-danger-ink" aria-hidden />}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-content-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-edge bg-canvas" aria-hidden />
          Available
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm border border-dashed border-edge-strong bg-canvas"
            aria-hidden
          />
          Break or lunch — available only if the teacher works through it
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm border border-danger/40 bg-danger/15"
            aria-hidden
          />
          Blocked
        </li>
      </ul>
    </div>
  );
};
