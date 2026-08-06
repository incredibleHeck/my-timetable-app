import React, { useMemo, useState } from "react";
import { AppData, ExamSession } from "../../../types";
import { ExamConflict } from "../logic/examValidation";
import { AlertTriangle, GripVertical, Lock, Plus, Users } from "lucide-react";
import { getExamGridDefaults, getSessionIndexForStartTime } from "../logic/examUtils";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragStartEvent,
  DragOverEvent,
} from "@dnd-kit/core";

const DraggableExamCard = ({
  exams,
  data,
  checkConflicts,
  onEdit,
  onToggleLock,
  isEditMode,
}: {
  exams: ExamSession[];
  data: AppData;
  checkConflicts: (exam: ExamSession) => string[];
  onEdit: (e: ExamSession) => void;
  onToggleLock?: (exam: ExamSession) => void;
  isEditMode: boolean;
}) => {
  const mainExam = exams[0];
  const subject = data.subjects.find((s) => s.id === mainExam.subjectId);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: mainExam.id,
    data: { type: "EXAM", exam: mainExam, allExams: exams },
    disabled: !isEditMode,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `target-${mainExam.id}`,
    data: { type: "EXAM_TARGET", exam: mainExam, allExams: exams },
    disabled: !isEditMode,
  });

  const setRefs = (node: HTMLElement | null) => {
    setNodeRef(node);
    setDropRef(node);
  };

  const paperGroups = useMemo(() => {
    const groups: Record<number, ExamSession[]> = {};
    exams.forEach((e) => {
      const pNum = e.paperNumber || 1;
      if (!groups[pNum]) groups[pNum] = [];
      groups[pNum].push(e);
    });
    return groups;
  }, [exams]);

  const paperNumbers = Object.keys(paperGroups).map(Number).sort();
  const isSplitView = paperNumbers.length > 1;

  if (isDragging) {
    return (
      <div
        ref={setRefs}
        className="min-h-[96px] w-full rounded-md border border-dashed border-edge-strong bg-surface-muted"
      />
    );
  }

  const renderExamStack = (stack: ExamSession[]) => (
    <div className="flex h-full flex-col gap-2">
      {stack.map((exam, index) => {
        const conflicts = checkConflicts(exam);
        const classNames = exam.classIds
          .map((cid) => data.classes.find((c) => c.id === cid)?.name)
          .join(", ");
        const invigilatorNames = (exam.invigilatorIds || [])
          .map((id) => data.teachers.find((t) => t.id === id)?.name)
          .filter(Boolean)
          .join(", ");
        const showHeader = index === 0;

        return (
          // A div, not a button: it holds the lock button, and a button cannot
          // nest inside a button. role/tabIndex/onKeyDown keep it operable by
          // keyboard.
          <div
            key={exam.id}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(exam);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onEdit(exam);
              }
            }}
            className={`group/card relative flex flex-1 cursor-pointer flex-col gap-2 overflow-hidden rounded-md border
                        border-l-2 bg-surface px-3 py-2.5 text-left transition-colors hover:border-edge-strong
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                        focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
                          conflicts.length > 0
                            ? "border-edge border-l-danger"
                            : "border-edge border-l-transparent"
                        }`}
            style={{
              borderLeftColor: conflicts.length > 0 ? undefined : subject?.color || undefined,
            }}
          >
            {showHeader && (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-content" title={subject?.name}>
                    {subject?.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-2xs tabular-nums text-content-muted">
                    <span>{exam.startTime}</span>
                    {exam.status && exam.status !== "DRAFT" && (
                      <span className="rounded bg-surface-inset px-1 py-px text-content-secondary">
                        {exam.status}
                      </span>
                    )}
                  </div>
                </div>
                {onToggleLock && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(exam);
                    }}
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded transition-colors ${
                      exam.locked
                        ? "text-accent-ink"
                        : "text-content-muted opacity-0 hover:text-content group-hover/card:opacity-100"
                    }`}
                    title={
                      exam.locked
                        ? "Unlock invigilator assignments"
                        : "Lock invigilator assignments"
                    }
                    aria-label={
                      exam.locked
                        ? "Unlock invigilator assignments"
                        : "Lock invigilator assignments"
                    }
                  >
                    <Lock size={13} aria-hidden />
                  </button>
                )}
              </div>
            )}

            <div className="text-xs text-content-secondary">{classNames}</div>
            <div className="flex items-center gap-1.5 text-2xs text-content-muted">
              <Users size={11} className="shrink-0" aria-hidden />
              <span className="truncate">
                {invigilatorNames || <span className="text-accent-ink">No staff assigned</span>}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      ref={setRefs}
      className={`group relative flex h-full w-full flex-col gap-1 rounded-md transition-shadow ${
        isOver && isEditMode ? "ring-2 ring-accent ring-offset-1 ring-offset-canvas" : ""
      }`}
    >
      {isEditMode && (
        <div
          {...listeners}
          {...attributes}
          className="absolute right-1 top-1 z-20 grid h-6 w-6 cursor-grab place-items-center rounded
                     border border-edge bg-surface text-content-muted opacity-0 transition-opacity
                     hover:text-content active:cursor-grabbing group-hover:opacity-100"
          aria-label="Drag to reschedule"
        >
          <GripVertical size={13} aria-hidden />
        </div>
      )}

      {isSplitView ? (
        <div className="grid h-full grid-cols-2 gap-2">
          {paperNumbers.map((pNum) => (
            <div key={pNum} className="flex min-w-0 flex-col gap-1">
              <div className="rounded bg-surface-inset py-0.5 text-center text-2xs font-medium text-content-secondary">
                Paper {pNum}
              </div>
              {renderExamStack(paperGroups[pNum])}
            </div>
          ))}
        </div>
      ) : (
        renderExamStack(exams)
      )}
    </div>
  );
};

const DroppableGridCell = ({
  date,
  startTime,
  children,
  isEditMode,
  isEmpty,
  onClick,
  activeConflicts = [],
}: {
  date: string;
  startTime: string;
  children: React.ReactNode;
  isEditMode: boolean;
  isEmpty: boolean;
  onClick?: () => void;
  activeConflicts?: ExamConflict[];
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${date}-${startTime}`,
    data: { type: "CELL_TARGET", date, startTime },
    disabled: !isEditMode,
  });

  const hasCritical = activeConflicts.some((c) => c.severity === "CRITICAL");
  const dropTone =
    isOver && isEditMode
      ? hasCritical
        ? "bg-danger/10 ring-2 ring-inset ring-danger/40"
        : "bg-success/10 ring-2 ring-inset ring-success/40"
      : "";

  return (
    <td
      ref={setNodeRef}
      onClick={onClick}
      className={`min-h-[120px] border-b border-r border-edge-subtle p-2 align-top transition-colors ${dropTone} ${
        isEmpty ? "cursor-pointer hover:bg-surface-muted" : ""
      }`}
    >
      <div className="relative h-full min-h-[96px] w-full">
        {isOver && activeConflicts.length > 0 && (
          <div className="pointer-events-none absolute -left-1 -top-1 z-30 min-w-[12rem] rounded-md border border-edge bg-surface p-2 shadow-lg">
            <ul className="space-y-1">
              {activeConflicts.map((c, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-1.5 text-2xs ${
                    c.severity === "CRITICAL" ? "text-danger-ink" : "text-accent-ink"
                  }`}
                >
                  <AlertTriangle size={11} className="mt-px shrink-0" aria-hidden />
                  <span>{c.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {isEmpty && !isOver ? (
          <div className="flex h-full min-h-[96px] items-center justify-center text-content-muted opacity-0 transition-opacity hover:opacity-100">
            <Plus size={16} aria-hidden />
          </div>
        ) : (
          children
        )}
      </div>
    </td>
  );
};

interface Props {
  data: AppData;
  exams: ExamSession[];
  /** Rows to render, in order. Includes empty days the user has added. */
  dates: string[];
  activeId?: string;
  onEdit: (exam: ExamSession) => void;
  onAddCell?: (date: string, time: string) => void;
  onAddDay?: () => void;
  checkConflicts: (exam: ExamSession) => string[];
  checkMoveConflicts: (
    ids: string[],
    date: string,
    time: string,
    ignoreIds?: string[],
  ) => ExamConflict[];
  onSwap: (ids1: string | string[], ids2: string | string[]) => void;
  onMoveToSlot: (ids: string[], date: string, startTime: string) => void;
  onToggleLock?: (exam: ExamSession) => void;
  isEditMode: boolean;
}

export const ExamGrid: React.FC<Props> = ({
  data,
  exams,
  dates,
  onEdit,
  onAddCell,
  onAddDay,
  checkConflicts,
  checkMoveConflicts,
  onSwap,
  onMoveToSlot,
  onToggleLock,
  isEditMode,
}) => {
  const { columns: sessionColumns } = useMemo(
    () => getExamGridDefaults(data.settings),
    [data.settings],
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [currentConflicts, setCurrentConflicts] = useState<ExamConflict[]>([]);
  const [overCell, setOverCell] = useState<{ date: string; time: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;
    const overData = over?.data.current;
    const activeData = active.data.current;
    if (!overData || !activeData) {
      setOverCell(null);
      setCurrentConflicts([]);
      return;
    }

    const activeIds = activeData.allExams.map((e: ExamSession) => e.id);

    if (overData.type === "CELL_TARGET") {
      setOverCell({ date: overData.date, time: overData.startTime });
      setCurrentConflicts(
        checkMoveConflicts(activeIds, overData.date, overData.startTime, activeIds),
      );
    } else if (overData.type === "EXAM_TARGET" && overData.exam) {
      const targetExam = overData.exam;
      setOverCell({ date: targetExam.date, time: targetExam.startTime });
      const overIds = overData.allExams.map((e: ExamSession) => e.id);
      setCurrentConflicts(
        checkMoveConflicts(activeIds, targetExam.date, targetExam.startTime, [
          ...activeIds,
          ...overIds,
        ]),
      );
    } else {
      setOverCell(null);
      setCurrentConflicts([]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    setOverCell(null);
    setCurrentConflicts([]);

    const { active, over } = event;
    if (!over || !isEditMode) return;

    const activeData = active.data.current;
    const overData = over.data.current;
    if (!activeData || !overData) return;

    const activeIds = activeData.allExams.map((e: ExamSession) => e.id);

    if (overData.type === "EXAM_TARGET") {
      if (active.id === overData.exam.id) return;
      onSwap(
        activeIds,
        overData.allExams.map((e: ExamSession) => e.id),
      );
    } else if (overData.type === "CELL_TARGET") {
      onMoveToSlot(activeIds, overData.date, overData.startTime);
    }
  };

  const getStacks = (sessions: ExamSession[]) => {
    const stacks: ExamSession[][] = [];
    const processedIds = new Set<string>();
    sessions.forEach((s) => {
      if (processedIds.has(s.id)) return;
      const siblings = sessions.filter(
        (o) =>
          o.subjectId === s.subjectId &&
          o.paperNumber === s.paperNumber &&
          o.startTime === s.startTime &&
          !processedIds.has(o.id),
      );
      if (siblings.length > 0) {
        stacks.push(siblings);
        siblings.forEach((sib) => processedIds.add(sib.id));
      }
    });
    return stacks;
  };

  const draggedExam = activeDragId ? exams.find((e) => e.id === activeDragId) : undefined;
  const draggedSubject = draggedExam
    ? data.subjects.find((s) => s.id === draggedExam.subjectId)
    : undefined;

  const colCount = sessionColumns.length + 1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-hidden rounded-lg border border-edge bg-surface">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-edge bg-surface-muted">
              <th className="sticky left-0 z-20 w-[110px] border-r border-edge bg-surface-muted px-3 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-content-muted">
                Day
              </th>
              {sessionColumns.map((col) => (
                <th
                  key={col.index}
                  className="min-w-[280px] border-r border-edge px-3 py-2.5 text-left"
                >
                  <div className="text-sm font-medium text-content">{col.label}</div>
                  <div className="text-2xs text-content-muted">{col.headerHint}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const examsOnDate = exams.filter((e) => e.date === date);
              const parsed = new Date(date + "T12:00:00");

              return (
                <tr key={date} className="group">
                  <td className="sticky left-0 z-10 w-[110px] border-b border-r border-edge bg-canvas px-3 py-3 align-top">
                    <div className="text-2xs uppercase tracking-wide text-content-muted">
                      {parsed.toLocaleDateString("en-GB", { weekday: "short" })}
                    </div>
                    <div className="text-lg font-semibold tabular-nums text-content">
                      {parsed.toLocaleDateString("en-GB", { day: "numeric" })}
                    </div>
                    <div className="text-2xs text-content-muted">
                      {parsed.toLocaleDateString("en-GB", { month: "short" })}
                    </div>
                  </td>

                  {sessionColumns.map((col) => {
                    const cellExams = examsOnDate.filter(
                      (e) => getSessionIndexForStartTime(e.startTime, sessionColumns) === col.index,
                    );
                    const dropTime = col.defaultStartTime;

                    return (
                      <DroppableGridCell
                        key={`${date}-${col.index}`}
                        date={date}
                        startTime={dropTime}
                        isEditMode={isEditMode}
                        isEmpty={cellExams.length === 0}
                        onClick={() => !cellExams.length && onAddCell?.(date, dropTime)}
                        activeConflicts={
                          overCell?.date === date && overCell?.time === dropTime
                            ? currentConflicts
                            : []
                        }
                      >
                        <div className="flex h-full flex-col gap-2">
                          {getStacks(cellExams).map((stack) => (
                            <DraggableExamCard
                              key={stack[0].id}
                              exams={stack}
                              data={data}
                              checkConflicts={checkConflicts}
                              onEdit={onEdit}
                              onToggleLock={onToggleLock}
                              isEditMode={isEditMode}
                            />
                          ))}
                        </div>
                      </DroppableGridCell>
                    );
                  })}
                </tr>
              );
            })}

            {onAddDay && (
              <tr>
                <td colSpan={colCount} className="border-t border-edge p-0">
                  <button
                    type="button"
                    onClick={onAddDay}
                    className="flex w-full items-center justify-center gap-1.5 py-2.5 text-xs
                               text-content-muted transition-colors hover:bg-surface-muted
                               hover:text-content focus-visible:outline-none focus-visible:ring-2
                               focus-visible:ring-inset focus-visible:ring-accent"
                  >
                    <Plus size={14} aria-hidden />
                    Add another day
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DragOverlay>
        {draggedExam ? (
          <div className="w-64 rounded-md border border-edge bg-surface px-3 py-2.5 shadow-lg">
            <div
              className="mb-1 h-1 w-8 rounded-full"
              style={{ backgroundColor: draggedSubject?.color || undefined }}
            />
            <div className="truncate text-sm font-medium text-content">
              {draggedSubject?.name ?? "Exam"}
            </div>
            <div className="text-2xs text-content-muted">Release to reschedule</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
