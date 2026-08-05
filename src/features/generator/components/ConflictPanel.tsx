import React, { useMemo } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Conflict } from "../../../types";

interface Props {
  conflicts: Conflict[];
  selectedConflict?: Conflict | null;
  onConflictSelect?: (conflict: Conflict) => void;
}

function conflictKey(c: Conflict): string {
  return [
    c.classId,
    c.day,
    c.period,
    c.subjectId ?? "",
    c.teacherId ?? "",
    c.missingPeriods ?? "",
    c.reason,
  ].join("|");
}

function conflictsMatch(a: Conflict, b: Conflict): boolean {
  return conflictKey(a) === conflictKey(b);
}

function isCurriculumGap(c: Conflict): boolean {
  const r = c.reason.toLowerCase();
  return (
    (c.missingPeriods != null && c.missingPeriods > 0) ||
    r.includes("curriculum gap") ||
    r.includes("unplaced")
  );
}

function isHardCollision(c: Conflict): boolean {
  return c.kind !== "quality" && !isCurriculumGap(c);
}

function hasGridLocation(c: Conflict): boolean {
  if (isCurriculumGap(c)) return false;
  return c.day != null && c.period != null;
}

function getCollisionLabel(c: Conflict): string {
  const r = c.reason.toLowerCase();
  if (r.includes("double booking") && r.includes("teacher")) return "Teacher overlap";
  if (r.includes("double booking") && r.includes("room")) return "Room overlap";
  if (r.includes("teacher") && r.includes("busy")) return "Teacher clash";
  if (r.includes("room")) return "Room clash";
  return "Scheduling clash";
}

function getResolutionHint(c: Conflict): string {
  const r = c.reason.toLowerCase();

  if (r.includes("curriculum gap") || (c.missingPeriods != null && c.missingPeriods > 0)) {
    const n = c.missingPeriods ?? 1;
    return `Assign ${n} more period${n === 1 ? "" : "s"} to ${c.className}'s grid in Edit mode, or reduce the curriculum target and regenerate.`;
  }
  if (r.includes("unplaced")) {
    return "Enable Manual Placement in Edit mode, click + on an empty slot, and assign the missing lesson.";
  }
  if (r.includes("double booking") && r.includes("teacher")) {
    return "Drag one of the conflicting lessons to a free slot, or assign a different teacher in Edit mode.";
  }
  if (r.includes("double booking") && r.includes("room")) {
    return "Move one class to another room or reschedule to a period where the room is available.";
  }
  if (r.includes("teacher")) {
    return "Move this lesson to a period when the teacher is free, or assign a substitute teacher.";
  }
  if (r.includes("room")) {
    return "Choose a different room or move this lesson to an unoccupied slot.";
  }
  return "Open Edit mode, adjust the slot on the grid, and the conflict will clear once the timetable is valid.";
}

/**
 * Severity is carried by a left rule and the count, not by tinting whole cards.
 * Every row here is a problem, so painting them all red and amber made the list
 * uniformly loud and left nothing for the selected row to say.
 */
function ConflictCard({
  conflict,
  variant,
  isSelected,
  onSelect,
}: {
  conflict: Conflict;
  variant: "collision" | "unplaced";
  isSelected: boolean;
  onSelect?: (conflict: Conflict) => void;
}) {
  const isCollision = variant === "collision";

  const unitBadge = conflict.missingPeriods
    ? `${conflict.missingPeriods} missing`
    : conflict.duration === 2
      ? "Double"
      : hasGridLocation(conflict)
        ? "Single"
        : null;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(conflict)}
      aria-pressed={isSelected}
      className={`w-full rounded-md border border-l-2 px-3 py-2.5 text-left transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
                    isCollision ? "border-l-danger" : "border-l-accent"
                  } ${
                    isSelected
                      ? "border-edge-strong bg-surface-muted"
                      : "border-edge bg-surface hover:border-edge-strong"
                  }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-content">
            {conflict.subjectName || "Unresolved lesson"}
          </p>
          <p className="mt-0.5 truncate text-xs text-content-muted">
            {isCollision ? getCollisionLabel(conflict) : "Curriculum shortfall"}
          </p>
        </div>
        {unitBadge && (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-edge px-2 py-0.5 text-2xs text-content-secondary">
            {unitBadge}
          </span>
        )}
      </div>

      <p className="mt-1.5 truncate text-xs text-content-secondary">
        <span>{conflict.className}</span>
        {conflict.teacherName && (
          <>
            <span className="text-content-muted" aria-hidden>
              {" · "}
            </span>
            <span className="text-content-muted">{conflict.teacherName}</span>
          </>
        )}
      </p>

      {hasGridLocation(conflict) && (
        <p className="mt-1 flex gap-2 text-2xs tabular-nums text-content-muted">
          <span>Day {conflict.day + 1}</span>
          <span>Period {conflict.period + 1}</span>
        </p>
      )}

      {isSelected && (
        <div className="mt-2.5 border-t border-edge-subtle pt-2.5">
          <p className="text-2xs font-medium text-content-secondary">How to fix</p>
          <p className="mt-1 text-xs leading-relaxed text-content-muted">
            {getResolutionHint(conflict)}
          </p>
        </div>
      )}
    </button>
  );
}

function ResolutionSection({
  title,
  icon,
  count,
  items,
  emptyMessage,
  selectedConflict,
  onConflictSelect,
  variant,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  items: Conflict[];
  emptyMessage: string;
  selectedConflict?: Conflict | null;
  onConflictSelect?: (conflict: Conflict) => void;
  variant: "collision" | "unplaced";
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-edge bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-edge px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-content">
          {icon}
          {title}
        </h3>
        <span className="text-xs tabular-nums text-content-muted">{count}</span>
      </header>
      <div className="custom-scrollbar max-h-[280px] space-y-1.5 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="flex items-center gap-2 px-1 py-3 text-xs text-content-muted">
            <CheckCircle2 size={13} className="shrink-0 text-success-ink" aria-hidden />
            {emptyMessage}
          </p>
        ) : (
          items.map((c) => (
            <ConflictCard
              key={conflictKey(c)}
              conflict={c}
              variant={variant}
              isSelected={!!selectedConflict && conflictsMatch(c, selectedConflict)}
              onSelect={onConflictSelect}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ValidTimetableEmptyState() {
  return (
    <div className="w-96 rounded-lg border border-edge bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-content">
        <CheckCircle2 size={15} className="shrink-0 text-success-ink" aria-hidden />
        Timetable Valid
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-content-muted">
        No hard collisions and no curriculum gaps. Every lesson the curriculum asks for has a slot
        the constraints allow.
      </p>
    </div>
  );
}

export const ConflictPanel: React.FC<Props> = ({
  conflicts,
  selectedConflict,
  onConflictSelect,
}) => {
  const { hardCollisions, unplacedLessons, qualityWarnings } = useMemo(() => {
    const hard: Conflict[] = [];
    const unplaced: Conflict[] = [];
    const quality: Conflict[] = [];

    for (const c of conflicts) {
      if (c.kind === "quality") {
        quality.push(c);
      } else if (isCurriculumGap(c)) {
        unplaced.push(c);
      } else {
        hard.push(c);
      }
    }

    const sortByClass = (a: Conflict, b: Conflict) =>
      (a.className || "").localeCompare(b.className || "", undefined, {
        numeric: true,
      });

    hard.sort(sortByClass);
    unplaced.sort(sortByClass);

    return {
      hardCollisions: hard,
      unplacedLessons: unplaced,
      qualityWarnings: quality,
    };
  }, [conflicts]);

  const blockingCount = hardCollisions.length + unplacedLessons.length;

  if (blockingCount === 0 && qualityWarnings.length === 0) {
    return <ValidTimetableEmptyState />;
  }

  return (
    <div className="flex h-fit max-h-[calc(100vh-140px)] w-96 flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-content">Issues to resolve</h2>
        <p className="mt-0.5 text-xs text-content-muted">
          <span className="tabular-nums">{blockingCount}</span> blocking{" "}
          {blockingCount === 1 ? "issue" : "issues"} in the final timetable. Select one to highlight
          it on the grid.
        </p>
      </div>

      <ResolutionSection
        title="Hard Collisions"
        icon={<AlertCircle size={15} className="text-danger-ink" aria-hidden />}
        count={hardCollisions.length}
        items={hardCollisions}
        emptyMessage="Nothing double-booked."
        selectedConflict={selectedConflict}
        onConflictSelect={onConflictSelect}
        variant="collision"
      />

      <ResolutionSection
        title="Unplaced Lessons"
        icon={<AlertTriangle size={15} className="text-accent-ink" aria-hidden />}
        count={unplacedLessons.length}
        items={unplacedLessons}
        emptyMessage="Every curriculum lesson was placed."
        selectedConflict={selectedConflict}
        onConflictSelect={onConflictSelect}
        variant="unplaced"
      />

      {qualityWarnings.length > 0 && (
        <ResolutionSection
          title="Layout Preferences"
          icon={<AlertTriangle size={15} className="text-content-muted" aria-hidden />}
          count={qualityWarnings.length}
          items={qualityWarnings}
          emptyMessage=""
          selectedConflict={selectedConflict}
          onConflictSelect={onConflictSelect}
          variant="collision"
        />
      )}
    </div>
  );
};

export { conflictKey, conflictsMatch, isCurriculumGap, isHardCollision, getResolutionHint };
