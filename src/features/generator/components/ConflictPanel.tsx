import React, { useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Lightbulb,
  Sparkles,
  Users,
} from "lucide-react";
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

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "red" | "amber" | "slate";
}) {
  const tones = {
    neutral: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
    red: "bg-red-50 text-red-700 border border-red-100",
    amber: "bg-amber-50 text-amber-800 border border-amber-100",
    slate:
      "bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function SectionEmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-4 rounded-lg bg-emerald-50/60 border border-emerald-100 text-emerald-700 text-xs font-medium">
      <CheckCircle2 size={14} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

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
  const borderAccent = isCollision ? "border-l-red-500" : "border-l-amber-400";
  const selectedRing = isSelected
    ? isCollision
      ? "ring-2 ring-red-200 bg-red-50/30"
      : "ring-2 ring-amber-200 bg-amber-50/30"
    : "bg-white dark:bg-slate-800";

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
      className={`w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 border-l-4 ${borderAccent} ${selectedRing} shadow-sm p-3 transition-colors hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
            {conflict.subjectName || "Unresolved lesson"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {isCollision ? getCollisionLabel(conflict) : "Curriculum shortfall"}
          </p>
        </div>
        {unitBadge && <Badge tone={isCollision ? "red" : "amber"}>{unitBadge}</Badge>}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <BookOpen size={12} className="shrink-0 text-slate-400" />
          <span className="truncate font-medium">{conflict.className}</span>
        </div>

        {conflict.teacherName && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <Users size={12} className="shrink-0 text-slate-400" />
            <span className="truncate">{conflict.teacherName}</span>
          </div>
        )}

        {hasGridLocation(conflict) && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            <Badge tone="slate">
              <Calendar size={10} />
              Day {conflict.day + 1}
            </Badge>
            <Badge tone="slate">
              <Clock size={10} />
              Period {conflict.period + 1}
            </Badge>
          </div>
        )}
      </div>

      {isSelected && (
        <div
          className={`mt-3 pt-3 border-t ${isCollision ? "border-red-100" : "border-amber-100"}`}
        >
          <div className="flex items-start gap-2">
            <Lightbulb
              size={14}
              className={`shrink-0 mt-0.5 ${isCollision ? "text-red-500" : "text-amber-500"}`}
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                How to fix
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                {getResolutionHint(conflict)}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isSelected && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
          <ChevronRight size={10} />
          <span>Click to highlight on grid</span>
        </div>
      )}
    </button>
  );
}

function ResolutionSection({
  title,
  icon,
  count,
  tone,
  items,
  emptyMessage,
  selectedConflict,
  onConflictSelect,
  variant,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  tone: "red" | "amber";
  items: Conflict[];
  emptyMessage: string;
  selectedConflict?: Conflict | null;
  onConflictSelect?: (conflict: Conflict) => void;
  variant: "collision" | "unplaced";
}) {
  const headerBg = tone === "red" ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100";
  const headerText = tone === "red" ? "text-red-800" : "text-amber-900";
  const badgeBg = tone === "red" ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-900";

  return (
    <section className="flex flex-col border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      <header className={`p-3 border-b flex justify-between items-center ${headerBg}`}>
        <h3 className={`font-bold flex items-center gap-2 text-sm ${headerText}`}>
          {icon}
          {title}
        </h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg}`}>{count}</span>
      </header>
      <div className="overflow-y-auto p-3 space-y-2 custom-scrollbar max-h-[280px]">
        {items.length === 0 ? (
          <SectionEmptyState message={emptyMessage} />
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
    <div className="w-96 flex flex-col items-center text-center p-8 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white shadow-lg">
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <Sparkles size={18} className="absolute -top-1 -right-1 text-amber-400" />
      </div>
      <h3 className="text-lg font-bold text-emerald-900 mb-2">Timetable Valid</h3>
      <p className="text-sm text-emerald-700/90 leading-relaxed max-w-[260px]">
        No hard collisions or curriculum gaps detected. Your final timetable is 100% schedulable.
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
    <div className="w-96 flex flex-col gap-3 h-fit max-h-[calc(100vh-140px)]">
      <div className="px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Resolution Center
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {blockingCount} issue{blockingCount === 1 ? "" : "s"} in final timetable
        </p>
      </div>

      <ResolutionSection
        title="Hard Collisions"
        icon={<AlertCircle size={16} />}
        count={hardCollisions.length}
        tone="red"
        items={hardCollisions}
        emptyMessage="Zero Hard Collisions 🎉"
        selectedConflict={selectedConflict}
        onConflictSelect={onConflictSelect}
        variant="collision"
      />

      <ResolutionSection
        title="Unplaced Lessons"
        icon={<AlertTriangle size={16} />}
        count={unplacedLessons.length}
        tone="amber"
        items={unplacedLessons}
        emptyMessage="Zero Unplaced Lessons 🎉"
        selectedConflict={selectedConflict}
        onConflictSelect={onConflictSelect}
        variant="unplaced"
      />

      {qualityWarnings.length > 0 && (
        <ResolutionSection
          title="Layout Preferences"
          icon={<AlertTriangle size={16} className="text-yellow-600" />}
          count={qualityWarnings.length}
          tone="amber"
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
