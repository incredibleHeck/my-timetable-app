import React, { useMemo, useState } from "react";
import { AppData, ExamSession, Subject } from "../../../types";
import {
  AlertTriangle,
  Clock,
  MapPin,
  GripVertical,
  CalendarDays,
  Users,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";

// --- COMPONENTS ---

// 1. Draggable Exam Card (Renders a stack of sessions, with support for Intra-Column Split)
const DraggableExamCard = ({
  exams,
  data,
  activeId,
  checkConflicts,
  onEdit,
  isEditMode,
}: {
  exams: ExamSession[];
  data: AppData;
  activeId: string;
  checkConflicts: (exam: ExamSession) => string[];
  onEdit: (e: ExamSession) => void;
  isEditMode: boolean;
}) => {
  // We use the first exam in the stack as the "Anchor" for ID and Subject info
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

  // Combine refs to allow this card to be both draggable AND a drop target (for swapping)
  const setRefs = (node: HTMLElement | null) => {
    setNodeRef(node);
    setDropRef(node);
  };

  // Group exams by Paper Number for Split View
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
        className="opacity-30 bg-slate-200 border-2 border-dashed border-slate-400 rounded-xl min-h-[100px] w-full"
      />
    );
  }

  const renderExamStack = (stack: ExamSession[]) => {
    return (
      <div className="flex flex-col gap-1 h-full">
        {stack.map((exam, index) => {
          const conflicts = checkConflicts(exam);
          const room = data.rooms.find((r) => r.id === exam.roomId);
          const hasRoom = !!exam.roomId;

          // Resolve Names
          const invigilatorNames = (exam.invigilatorIds || [])
            .map((id) => data.teachers.find((t) => t.id === id)?.name)
            .filter(Boolean)
            .join(", ");

          const classNames = exam.classIds
            .map((cid) => data.classes.find((c) => c.id === cid)?.name)
            .join(", ");

          // Only show Subject/Time header on the FIRST card in the stack to save space
          const showHeader = index === 0;

          return (
            <div
              key={exam.id}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(exam);
              }}
              className={`
                relative flex-1 flex flex-col justify-center bg-white rounded-lg border-l-[4px] shadow-sm hover:shadow-md transition-all px-3 py-2 cursor-pointer
                ${
                  conflicts.length > 0
                    ? "border-l-red-500 border-red-100 bg-red-50/30"
                    : "border-slate-200"
                }
                ${!showHeader ? "mt-0.5 border-t border-slate-100" : ""}
              `}
              style={{
                borderLeftColor:
                  conflicts.length > 0 ? undefined : subject?.color,
              }}
            >
              {/* Conflict Indicator */}
              {conflicts.length > 0 && (
                <div
                  className="absolute -top-1.5 -left-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm z-10 animate-pulse"
                  title={conflicts.join("\n")}
                >
                  <AlertTriangle size={10} />
                </div>
              )}

              {showHeader && (
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex flex-col">
                    <div
                      className="font-black text-slate-800 text-[13px] leading-tight uppercase truncate max-w-[140px]"
                      title={subject?.name}
                    >
                      {subject?.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1 rounded flex items-center gap-0.5">
                        <Clock size={8} /> {exam.startTime}
                      </span>
                      <span
                        className="text-[8px] font-black text-white px-1.5 py-0 rounded-sm uppercase"
                        style={{ backgroundColor: subject?.color || "#94a3b8" }}
                      >
                        {exam.paperLabel || `P${exam.paperNumber}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Class & Details Row */}
              <div className="flex flex-col gap-1">
                {activeId === "ALL" && (
                  <div className="text-[11px] font-bold text-slate-700 truncate">
                    {classNames}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-slate-50 pt-1">
                  <div
                    className={`flex items-center gap-1 text-[9px] font-bold truncate max-w-[45%] ${
                      hasRoom ? "text-slate-500" : "text-amber-600"
                    }`}
                  >
                    <MapPin size={9} /> {hasRoom ? room?.name : "NO ROOM"}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 truncate max-w-[50%]">
                    <Users size={9} /> {invigilatorNames || "NO STAFF"}
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
            ? "ring-4 ring-amber-400 rounded-xl z-10 scale-[1.02] shadow-xl"
            : ""
        }
      `}
    >
      {/* Drag Handle (Visible on hover in Edit Mode) */}
      {isEditMode && (
        <div
          {...listeners}
          {...attributes}
          className="absolute -top-2 -right-2 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 z-30 p-1.5 bg-white border border-slate-200 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical size={14} />
        </div>
      )}

      {/* RENDER CONTENT: Split View or Standard Stack */}
      {isSplitView ? (
        <div className="grid grid-cols-2 gap-1 h-full">
          {paperNumbers.map((pNum) => (
            <div key={pNum} className="flex flex-col gap-0.5 min-w-0">
              {/* Mini Header for Split View */}
              <div className="text-[9px] font-bold text-slate-400 uppercase text-center bg-slate-50 rounded-t py-0.5">
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

// 3. Main component setup follows...

// --- MAIN COMPONENT ---

interface Props {
  data: AppData;
  exams: ExamSession[];
  activeId?: string;
  onEdit: (exam: ExamSession) => void;
  checkConflicts: (exam: ExamSession) => string[];
  onSwap: (ids1: string | string[], ids2: string | string[]) => void;
  isEditMode: boolean;
}

export const ExamGrid: React.FC<Props> = ({
  data,
  exams,
  activeId = "ALL",
  onEdit,
  checkConflicts,
  onSwap,
  isEditMode,
}) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Configure sensors for drag activation distance (prevents accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(exams.map((e) => e.date))).sort();
  }, [exams]);

  // Derived Session Times (Fallback)
  const defaultTimes = ["09:00", "14:00"];

  // --- DND HANDLERS ---
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || !isEditMode) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Safety check
    if (!activeData || !overData) return;

    const activeIds = activeData.allExams.map((e: ExamSession) => e.id);

    // ONLY HANDLE DROP ON ANOTHER EXAM (Swap)
    if (overData.type === "EXAM_TARGET") {
      const targetExam = overData.exam;
      // Prevent self-drop
      if (active.id === targetExam.id) return;

      const overIds = overData.allExams.map((e: ExamSession) => e.id);
      onSwap(activeIds, overIds);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveDragId(e.active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full border border-slate-200 rounded-2xl overflow-hidden shadow-lg bg-white">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-900 text-white">
              {/* Corner Header */}
              <th className="p-4 border-r border-slate-800 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest w-[140px] sticky left-0 z-40 bg-slate-900 shadow-md">
                Date
              </th>
              {/* Session Headers */}
              <th className="p-4 border-r border-slate-800 text-center min-w-[350px] sticky top-0 z-20 shadow-md">
                <div className="flex flex-col gap-1">
                  <span className="font-black text-sm uppercase tracking-widest">
                    Subject 1
                  </span>
                </div>
              </th>
              <th className="p-4 border-r border-slate-800 text-center min-w-[350px] sticky top-0 z-20 shadow-md">
                <div className="flex flex-col gap-1">
                  <span className="font-black text-sm uppercase tracking-widest">
                    Subject 2
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {uniqueDates.map((date) => {
              const examsOnDate = exams.filter((e) => e.date === date);

              // Sort exams by time
              const sortedByTime = [...examsOnDate].sort((a, b) =>
                a.startTime.localeCompare(b.startTime)
              );

              // GROUP BY SUBJECT and Assign to Columns sequentially (NOT time-bound)
              const subjectGroups: Record<string, ExamSession[]> = {};
              sortedByTime.forEach((e) => {
                if (!subjectGroups[e.subjectId]) subjectGroups[e.subjectId] = [];
                subjectGroups[e.subjectId].push(e);
              });

              // Sort subject groups by their EARLIEST exam's start time to maintain a logical order
              const sortedSubjectGroups = Object.values(subjectGroups).sort((groupA, groupB) => {
                const minA = groupA.reduce((min, e) => e.startTime < min ? e.startTime : min, "23:59");
                const minB = groupB.reduce((min, e) => e.startTime < min ? e.startTime : min, "23:59");
                return minA.localeCompare(minB);
              });

              // Column 1 = First Subject Group of the day
              // Column 2 = Second Subject Group of the day (if it exists)
              const session1Exams: ExamSession[] = sortedSubjectGroups[0] || [];
              const session2Exams: ExamSession[] = sortedSubjectGroups[1] || [];

              const defaultTimes = ["09:00", "14:00"];
              const time1 = defaultTimes[0];
              const time2 = defaultTimes[1];

              // --- INTELLIGENT GROUPING LOGIC ---
              // Groups exams into "Stacks" if they share Subject. 
              // Now supports grouping multiple papers (P1, P2) for Split View.
              const getSlots = (sessions: ExamSession[]) => {
                const units: ExamSession[][] = [];
                const processedIds = new Set<string>();

                sessions.forEach((s) => {
                  if (processedIds.has(s.id)) return;

                  // Find siblings: Same Subject (regardless of Paper/Duration)
                  const siblings = sessions.filter(
                    (o) =>
                      o.subjectId === s.subjectId &&
                      !processedIds.has(o.id)
                  );

                  if (siblings.length > 0) {
                    units.push(siblings);
                    siblings.forEach((sib) => processedIds.add(sib.id));
                  }
                });
                return units;
              };

              return (
                <tr
                  key={date}
                  className="group border-b border-slate-100 min-h-[160px]"
                >
                  <td className="p-4 border-r border-slate-200 text-center w-[140px] sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-slate-50">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {new Date(date).toLocaleDateString("en-GB", { weekday: "short" })}
                      </span>
                      <span className="text-2xl font-black text-slate-800">
                        {new Date(date).toLocaleDateString("en-GB", { day: "numeric" })}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        {new Date(date).toLocaleDateString("en-GB", { month: "short" })}
                      </span>
                    </div>
                  </td>

                  {/* SESSION 1 */}
                  <td className="p-3 border-r border-slate-100 align-top h-px bg-white hover:bg-slate-50/30">
                    <div className="h-full w-full">
                      <div className="flex flex-col h-full gap-3">
                        {getSlots(session1Exams).map((slot) => (
                          <DraggableExamCard
                            key={slot[0].id}
                            exams={slot}
                            data={data}
                            activeId={activeId}
                            checkConflicts={checkConflicts}
                            onEdit={onEdit}
                            isEditMode={isEditMode}
                          />
                        ))}
                      </div>
                    </div>
                  </td>

                  {/* SESSION 2 */}
                  <td className="p-3 border-r border-slate-100 align-top h-px bg-white hover:bg-slate-50/30">
                    <div className="h-full w-full">
                      <div className="flex flex-col h-full gap-3">
                        {getSlots(session2Exams).map((slot) => (
                          <DraggableExamCard
                            key={slot[0].id}
                            exams={slot}
                            data={data}
                            activeId={activeId}
                            checkConflicts={checkConflicts}
                            onEdit={onEdit}
                            isEditMode={isEditMode}
                          />
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DragOverlay>
        {activeDragId ? (
          <div className="bg-white p-4 rounded-xl shadow-2xl border-2 border-amber-400 w-72 rotate-3 cursor-grabbing opacity-90 scale-105 pointer-events-none ring-4 ring-black/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <CalendarDays size={20} />
              </div>
              <div className="flex flex-col">
                <div className="font-black text-slate-800 text-sm uppercase">
                  Rescheduling...
                </div>
                <div className="text-[10px] text-slate-500 font-bold">
                  Release to drop
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
