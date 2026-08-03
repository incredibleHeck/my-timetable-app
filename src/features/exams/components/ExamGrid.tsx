import React, { useMemo, useState } from "react";
import { AppData, ExamSession } from "../../../types";
import { ExamConflict } from "../logic/examValidation";
import { AlertTriangle, Clock, GripVertical, CalendarDays, Users, Lock } from "lucide-react";
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

// --- COMPONENTS ---

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
        className="opacity-30 bg-slate-200 dark:bg-slate-700 border-2 border-dashed border-slate-400 rounded-xl min-h-[120px] w-full"
      />
    );
  }

  const renderExamStack = (stack: ExamSession[]) => {
    return (
      <div className="flex flex-col gap-2 h-full">
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
            <div
              key={exam.id}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(exam);
              }}
              className={`
                relative flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all p-4 cursor-pointer group/card
                ${conflicts.length > 0 ? "ring-2 ring-red-500 bg-red-50/10" : ""}
              `}
            >
              <div
                className="absolute top-0 left-0 w-full h-1.5 rounded-t-xl"
                style={{ backgroundColor: subject?.color || "#cbd5e1" }}
              />

              <div className="flex flex-col h-full gap-3">
                {showHeader && (
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <div
                        className="font-black text-slate-900 text-sm leading-tight uppercase tracking-tight"
                        title={subject?.name}
                      >
                        {subject?.name}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-2xs font-bold text-content-muted bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                          <Clock size={10} /> {exam.startTime}
                        </span>
                        {exam.status && exam.status !== "DRAFT" && (
                          <span className="text-2xs font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-white">
                            {exam.status}
                          </span>
                        )}
                        {exam.locked && <Lock size={10} className="text-accent-ink" />}
                      </div>
                    </div>
                    {onToggleLock && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLock(exam);
                        }}
                        className={`p-1 rounded ${
                          exam.locked
                            ? "text-accent-ink bg-amber-50 dark:bg-amber-900/30"
                            : "text-slate-300 hover:text-slate-500"
                        }`}
                        title={
                          exam.locked
                            ? "Unlock invigilator assignments"
                            : "Lock invigilator assignments"
                        }
                      >
                        <Lock size={12} />
                      </button>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2 flex-1 justify-center">
                  <div className="text-xs font-black text-slate-700 dark:text-slate-200 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md text-center">
                    {classNames}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-content-muted p-1 rounded-lg bg-slate-50/50 border border-transparent group-hover/card:border-slate-100 group-hover/card:bg-white transition-all">
                    <Users size={11} className="text-content-muted" />
                    <span className="truncate">{invigilatorNames || "NO STAFF ASSIGNED"}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={setRefs}
      className={`relative group flex flex-col gap-1 h-full w-full transition-all duration-200
        ${
          isOver && isEditMode
            ? "ring-4 ring-amber-400 rounded-2xl z-10 scale-[1.02] shadow-2xl"
            : ""
        }
      `}
    >
      {isEditMode && (
        <div
          {...listeners}
          {...attributes}
          className="absolute -top-3 -right-3 cursor-grab active:cursor-grabbing text-accent-ink hover:text-amber-700 z-30 p-2 bg-white dark:bg-slate-800 border-2 border-amber-100 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
        >
          <GripVertical size={16} />
        </div>
      )}

      {isSplitView ? (
        <div className="grid grid-cols-2 gap-2 h-full">
          {paperNumbers.map((pNum) => (
            <div key={pNum} className="flex flex-col gap-2 min-w-0">
              <div className="text-2xs font-black text-white uppercase text-center bg-slate-800 rounded-lg py-1 shadow-sm mb-1 tracking-wider">
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
  onClick,
  activeConflicts = [],
}: {
  date: string;
  startTime: string;
  children: React.ReactNode;
  isEditMode: boolean;
  onClick?: () => void;
  activeConflicts?: ExamConflict[];
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${date}-${startTime}`,
    data: { type: "CELL_TARGET", date, startTime },
    disabled: !isEditMode,
  });

  const hasCritical = activeConflicts.some((c) => c.severity === "CRITICAL");
  const hasWarning = activeConflicts.some((c) => c.severity === "WARNING");

  return (
    <td
      ref={setNodeRef}
      onClick={onClick}
      className={`p-3 border-r border-slate-100 dark:border-slate-700 align-top min-h-[150px] transition-all duration-200
        ${
          isOver && isEditMode
            ? hasCritical
              ? "bg-red-50 ring-inset ring-2 ring-red-300"
              : hasWarning
                ? "bg-amber-50 ring-inset ring-2 ring-amber-300"
                : "bg-emerald-50 ring-inset ring-2 ring-emerald-300"
            : "bg-white dark:bg-slate-800 hover:bg-slate-50/30"
        }
        ${!children ? "cursor-pointer" : ""}
      `}
    >
      <div className="h-full w-full relative min-h-[100px]">
        {isOver && activeConflicts.length > 0 && (
          <div className="absolute -top-1 -left-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg p-2 min-w-[200px] pointer-events-none animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col gap-1.5">
              {activeConflicts.map((c, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-1.5 text-2xs font-bold ${c.severity === "CRITICAL" ? "text-danger-ink" : "text-accent-ink"}`}
                >
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>{c.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {children}
      </div>
    </td>
  );
};

interface Props {
  data: AppData;
  exams: ExamSession[];
  activeId?: string;
  onEdit: (exam: ExamSession) => void;
  onAddCell?: (date: string, time: string) => void;
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
  onEdit,
  onAddCell,
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(exams.map((e) => e.date))).sort();
  }, [exams]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;
    if (!over || !active.data.current) {
      setOverCell(null);
      setCurrentConflicts([]);
      return;
    }

    const overData = over.data.current;
    const activeData = active.data.current;
    if (!overData || !activeData) {
      setOverCell(null);
      setCurrentConflicts([]);
      return;
    }

    const activeIds = activeData.allExams.map((e: ExamSession) => e.id);

    if (overData.type === "CELL_TARGET") {
      setOverCell({ date: overData.date, time: overData.startTime });
      const conflicts = checkMoveConflicts(activeIds, overData.date, overData.startTime, activeIds);
      setCurrentConflicts(conflicts);
    } else if (overData.type === "EXAM_TARGET") {
      const targetExam = overData.exam;
      if (targetExam) {
        setOverCell({ date: targetExam.date, time: targetExam.startTime });
        const overIds = overData.allExams.map((e: ExamSession) => e.id);
        const conflicts = checkMoveConflicts(activeIds, targetExam.date, targetExam.startTime, [
          ...activeIds,
          ...overIds,
        ]);
        setCurrentConflicts(conflicts);
      }
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
      const targetExam = overData.exam;
      if (active.id === targetExam.id) return;
      const overIds = overData.allExams.map((e: ExamSession) => e.id);
      onSwap(activeIds, overIds);
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-lg bg-white dark:bg-slate-800">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-4 border-r border-slate-800 text-left text-[11px] font-black text-content-muted uppercase tracking-widest w-[140px] sticky left-0 z-40 bg-slate-900 shadow-md">
                Date / Day
              </th>
              {sessionColumns.map((col) => (
                <th
                  key={col.index}
                  className="p-4 border-r border-slate-800 text-center min-w-[300px] sticky top-0 z-20 shadow-md"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-black text-sm uppercase tracking-widest">
                      {col.label}
                    </span>
                    <span className="text-2xs text-content-muted font-bold tracking-widest">
                      {col.headerHint}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniqueDates.map((date) => {
              const examsOnDate = exams.filter((e) => e.date === date);

              return (
                <tr
                  key={date}
                  className="group border-b border-slate-100 dark:border-slate-700 min-h-[220px]"
                >
                  <td className="p-4 border-r border-slate-200 dark:border-slate-700 text-center w-[140px] sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-slate-50 dark:bg-slate-900">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-2xs font-black text-content-muted uppercase tracking-widest">
                        {new Date(date).toLocaleDateString("en-GB", {
                          weekday: "short",
                        })}
                      </span>
                      <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                        {new Date(date).toLocaleDateString("en-GB", {
                          day: "numeric",
                        })}
                      </span>
                      <span className="text-2xs font-bold text-content-muted uppercase">
                        {new Date(date).toLocaleDateString("en-GB", {
                          month: "short",
                        })}
                      </span>
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
                        onClick={() => !cellExams.length && onAddCell?.(date, dropTime)}
                        activeConflicts={
                          overCell?.date === date && overCell?.time === dropTime
                            ? currentConflicts
                            : []
                        }
                      >
                        <div className="flex flex-col h-full gap-3">
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
          </tbody>
        </table>
      </div>

      <DragOverlay>
        {activeDragId ? (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-2xl border-2 border-amber-400 w-72 rotate-3 cursor-grabbing opacity-90 scale-105 pointer-events-none ring-4 ring-black/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-100 text-accent-ink rounded-lg">
                <CalendarDays size={20} />
              </div>
              <div className="flex flex-col">
                <div className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase">
                  Rescheduling...
                </div>
                <div className="text-2xs text-content-muted font-bold">Release to drop</div>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
