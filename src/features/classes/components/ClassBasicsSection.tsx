import React from "react";
import { AppData, FixedOccasion } from "../../../types";
import { ClassGroup } from "../types";
import { controlClass } from "../../../components/ui";
import { getOccasionLabel } from "../../../utils/utils";
import { DAYS } from "../../../utils/constants";

interface ClassBasicsSectionProps {
  data: AppData;
  editingClass: ClassGroup | null;
  cName: string;
  setCName: (name: string) => void;
  cPeriodCount: number;
  cFixedSessions: FixedOccasion[][];
  activeSlot: { d: number; p: number } | null;
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
  activeSlot,
  setSlotLabel,
  setActiveSlot,
}) => {
  const homeRoom = editingClass
    ? data.rooms.find((r) => r.id === editingClass.defaultRoomId)?.name || `${cName} Classroom`
    : `${cName || "New Class"} Classroom`;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="class-name" className="mb-1.5 block text-sm font-medium text-content">
          Class Name
        </label>
        <input
          id="class-name"
          className={`${controlClass} w-full`}
          value={cName}
          onChange={(e) => setCName(e.target.value)}
          placeholder="Grade 10A"
          autoFocus
        />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-content">Home Classroom</span>
        <p className="rounded-md border border-edge bg-canvas px-2.5 py-2 text-sm text-content-secondary">
          {homeRoom}
        </p>
        <p className="mt-1 text-2xs text-content-muted">
          Created and renamed automatically to match the class.
        </p>
      </div>

      <div>
        <span className="block text-sm font-medium text-content">Class-Specific Events</span>
        <p className="mb-2 mt-0.5 text-2xs text-content-muted">
          Periods this class alone gives up. School-wide reservations are shown locked.
        </p>

        <div className="overflow-x-auto rounded-md border border-edge">
          <div
            className="grid min-w-max gap-1 p-2"
            style={{ gridTemplateColumns: `2.25rem repeat(${cPeriodCount}, minmax(2.25rem, 1fr))` }}
          >
            <div aria-hidden />
            {Array.from({ length: cPeriodCount }).map((_, i) => (
              <div key={i} className="pb-0.5 text-center text-2xs text-content-muted">
                P{i + 1}
              </div>
            ))}

            {DAYS.map((d, dIdx) => (
              <React.Fragment key={d}>
                <div className="flex items-center text-2xs font-medium text-content-secondary">
                  {d.slice(0, 3)}
                </div>
                {Array.from({ length: cPeriodCount }).map((_, pIdx) => {
                  const globalLabel = getOccasionLabel(data.settings.fixedOccasions[dIdx]?.[pIdx]);
                  const localLabel = getOccasionLabel(cFixedSessions[dIdx]?.[pIdx]);
                  const isGlobal = Boolean(globalLabel);
                  const isActive = activeSlot?.d === dIdx && activeSlot?.p === pIdx;

                  return (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => {
                        if (isGlobal) return;
                        setSlotLabel(localLabel || "");
                        setActiveSlot({ d: dIdx, p: pIdx });
                      }}
                      disabled={isGlobal}
                      // The label was cut to four characters, so "Worship" read
                      // as "Wors". The full name lives in the title and the cell
                      // truncates with an ellipsis instead.
                      title={
                        isGlobal
                          ? `${globalLabel} — school-wide, edit in Configuration`
                          : localLabel || `Reserve ${d} period ${pIdx + 1}`
                      }
                      aria-label={
                        isGlobal
                          ? `${d} period ${pIdx + 1}: ${globalLabel}, school-wide`
                          : localLabel
                            ? `${d} period ${pIdx + 1}: ${localLabel}`
                            : `Reserve ${d} period ${pIdx + 1}`
                      }
                      className={`h-6 truncate rounded border px-1 text-2xs transition-colors
                                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                    isGlobal
                                      ? "cursor-not-allowed border-edge bg-surface-inset text-content-muted"
                                      : localLabel
                                        ? "border-accent/50 bg-accent/15 text-accent-ink"
                                        : "border-edge-subtle bg-canvas text-content-muted hover:border-edge-strong"
                                  } ${isActive ? "ring-2 ring-accent" : ""}`}
                    >
                      {localLabel || globalLabel || ""}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-content-muted">
          <li className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm border border-edge bg-surface-inset"
              aria-hidden
            />
            School-wide
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm border border-accent/50 bg-accent/15"
              aria-hidden
            />
            This class
          </li>
        </ul>
      </div>
    </div>
  );
};
