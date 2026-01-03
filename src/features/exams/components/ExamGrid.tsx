import React, { useMemo, useState } from "react";
import { AppData, ExamSession } from "../../../types";
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
  DragStartEvent,
} from "@dnd-kit/core";

// --- HOOKS FOR DND COMPONENTS ---

// 1. Draggable Exam Card Wrapper
const DraggableExamCard = ({
  exams,
  data,
  checkConflicts,
  onEdit,
  isEditMode,
}: {
  exams: ExamSession[];
  data: AppData;
  checkConflicts: (exam: ExamSession) => string[];
  onEdit: (e: ExamSession) => void;
  isEditMode: boolean;
}) => {
  const mainExam = exams[0];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: mainExam.id,
    data: { type: "EXAM", exam: mainExam, allExams: exams },
    disabled: !isEditMode,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: mainExam.id,
    data: { type: "EXAM_TARGET", exam: mainExam, allExams: exams },
    disabled: !isEditMode,
  });

  const subject = data.subjects.find((s) => s.id === mainExam.subjectId);

  // Combine refs for swap capability
  const setRefs = (node: HTMLElement | null) => {
    setNodeRef(node);
    setDropRef(node);
  };

  if (isDragging) {
    return (
      <div
        ref={setRefs}
        className="opacity-30 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg min-h-[140px]"
      />
    );
  }

  return (
    <div
      ref={setRefs}
      className={`relative group flex flex-col gap-1 h-full min-h-[140px] ${
        isOver && isEditMode ? "ring-2 ring-amber-400 rounded-lg p-1 bg-amber-50" : ""
      }`}
      style={{ transform: isDragging ? "scale(1.05)" : "scale(1)" }}
    >
      {/* Drag Handle (Unified for the slot) */}
      {isEditMode && (
        <div
          {...listeners}
          {...attributes}
          className="absolute top-2 right-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 z-10 p-1"
        >
          <GripVertical size={14} />
        </div>
      )}

      {exams.map((exam, index) => {
        const conflicts = checkConflicts(exam);
        const room = data.rooms.find((r) => r.id === exam.roomId);
        const hasRoom = !!exam.roomId;

        return (
          <div
            key={exam.id}
            onClick={() => onEdit(exam)}
            className={`
              relative flex-1 flex flex-col justify-center bg-white rounded-lg border-l-4 shadow-sm hover:shadow-md transition-all px-3 py-2 cursor-pointer
              ${
                conflicts.length > 0
                  ? "border-l-red-500 border-red-200 bg-red-50/10"
                  : "border-slate-200"
              }
              ${exams.length > 1 && index === 0 ? "mb-0.5" : ""}
            `}
            style={{
              borderLeftColor:
                conflicts.length > 0 ? undefined : subject?.color,
            }}
          >
            {/* Conflict Badge */}
            {conflicts.length > 0 && (
              <div className="absolute -top-1 -left-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm z-10 animate-pulse">
                <AlertTriangle size={10} />
              </div>
            )}

            {/* Time Header */}
            <div className="flex justify-between items-center mb-1 pr-4">
              <div className="flex items-center gap-1 text-slate-500 bg-slate-50 px-1 py-0.5 rounded text-[9px] font-bold">
                <Clock size={9} />
                {exam.startTime}
              </div>
              <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                {exam.paperLabel || `P${exam.paperNumber}`}
              </span>
            </div>

            {/* Subject Info */}
            <div className="">
              <h4
                className="font-bold text-slate-800 text-[13px] leading-tight truncate"
                title={subject?.name}
              >
                {subject?.name || "Unknown Subject"}
              </h4>
            </div>

            {/* Room Info */}
            <div
              className={`
              flex items-center gap-1.5 text-[10px] font-medium mt-1 pt-1 border-t border-dashed
              ${
                hasRoom
                  ? "text-slate-600 border-slate-100"
                  : "text-amber-600 border-amber-100"
              }
            `}
            >
              <MapPin
                size={10}
                className={hasRoom ? "text-slate-400" : "text-amber-500"}
              />
              <span className="truncate">{hasRoom ? room?.name : "Assign Room"}</span>
            </div>

            {/* Invigilator Info (NEW) */}
            <div className="flex items-center gap-1.5 text-[9px] font-medium text-slate-500 mt-0.5">
              <Users size={9} className="text-slate-400" />
              <span className="truncate">
                {exam.invigilatorIds?.length 
                  ? exam.invigilatorIds.map(id => data.teachers.find(t => t.id === id)?.name).join(", ")
                  : "No Invigilators"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 2. Droppable Day Column Header
const DroppableDayHeader = ({
  date,
  count,
  isEditMode,
}: {
  date: string;
  count: number;
  isEditMode: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `date-${date}`,
    data: { type: "DATE_TARGET", date },
    disabled: !isEditMode,
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div
      ref={setNodeRef}
      className={`
        flex items-center gap-3 border-b pb-2 transition-colors rounded px-2
        ${isOver && isEditMode ? "bg-indigo-50 border-indigo-300" : "border-slate-200"}
      `}
    >
      <div
        className={`p-1.5 rounded-full ${
          isOver && isEditMode
            ? "bg-indigo-100 text-indigo-600"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        <CalendarDays size={16} />
      </div>
      <div>
        <h3
          className={`text-lg font-bold ${
            isOver && isEditMode ? "text-indigo-700" : "text-slate-800"
          }`}
        >
          {formatDate(date)}
        </h3>
        {isOver && isEditMode && (
          <span className="text-[10px] text-indigo-500 font-bold block">
            Drop to move here
          </span>
        )}
      </div>
      {!isOver && (
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full ml-auto">
          {count} Slots
        </span>
      )}
    </div>
  );
};

// --- MAIN GRID COMPONENT ---

interface Props {
  data: AppData;
  exams: ExamSession[];
  onEdit: (exam: ExamSession) => void;
  checkConflicts: (exam: ExamSession) => string[];
  onSwap: (ids1: string | string[], ids2: string | string[]) => void;
  onMoveDate: (id: string | string[], date: string) => void;
  isEditMode: boolean;
  editTool: "MOVE" | "SWAP";
}

export const ExamGrid: React.FC<Props> = ({
  data,
  exams,
  onEdit,
  checkConflicts,
  onSwap,
  onMoveDate,
  isEditMode,
  editTool,
}) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Grouping Logic
  const groupedExams = useMemo(() => {
    const dateGroups: Record<string, ExamSession[]> = {};
    exams.forEach((exam) => {
      if (!dateGroups[exam.date]) dateGroups[exam.date] = [];
      dateGroups[exam.date].push(exam);
    });

    return Object.keys(dateGroups)
      .sort()
      .map((date) => {
        const dateSessions = dateGroups[date].sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        );

        // Group into "Slots" (Same subject and classes on the same day)
        const slots: ExamSession[][] = [];
        const processedIds = new Set<string>();

        dateSessions.forEach((s) => {
          if (processedIds.has(s.id)) return;

          const key = `${s.subjectId}-${[...s.classIds].sort().join(",")}`;
          const siblings = dateSessions.filter((other) => {
            const otherKey = `${other.subjectId}-${[...other.classIds]
              .sort()
              .join(",")}`;
            return otherKey === key;
          });

          slots.push(siblings);
          siblings.forEach((sib) => processedIds.add(sib.id));
        });

        return { date, slots };
      });
  }, [exams]);

  // Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;

    if (!over || !isEditMode) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeData = active.data.current;
    const overData = over.data.current;

    // Case 1: Dropped onto another Exam Slot
    if (activeId !== overId && overData?.type === "EXAM_TARGET") {
      const activeSlotIds = activeData?.allExams.map((e: ExamSession) => e.id);
      const overSlotIds = overData?.allExams.map((e: ExamSession) => e.id);
      
      if (editTool === 'SWAP') {
        onSwap(activeSlotIds, overSlotIds);
      } else {
        // In 'MOVE' mode, dropping on another exam is not a valid action.
        // You could add feedback here if desired.
        return;
      }
    }

    // Case 2: Dropped onto a Day Header (MOVE DATE)
    // This action is only valid in 'MOVE' mode.
    if (editTool === 'MOVE' && overData?.type === "DATE_TARGET") {
      const newDate = overData.date;
      const slotExams = activeData?.allExams as ExamSession[] | undefined;

      if (slotExams && slotExams.length > 0 && slotExams[0].date !== newDate) {
        const slotIds = slotExams.map(e => e.id);
        onMoveDate(slotIds, newDate);
      }
    }
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-8 pb-20 select-none">
        {groupedExams.map((group) => (
          <div key={group.date} className="space-y-3">
            {/* Droppable Header */}
            <DroppableDayHeader
              date={group.date}
              count={group.slots.length}
              isEditMode={isEditMode}
            />

            {/* Grid of Draggable Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
              {group.slots.map((slot) => (
                <DraggableExamCard
                  key={slot[0].id}
                  exams={slot}
                  data={data}
                  checkConflicts={checkConflicts}
                  onEdit={onEdit}
                  isEditMode={isEditMode}
                />
              ))}

              {/* Empty State placeholder for drop zones if needed */}
              {group.slots.length === 0 && (
                <div className="col-span-4 h-16 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-sm">
                  Drag exams here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Drag Overlay (Visual Preview while dragging) */}
      <DragOverlay>
        {activeDragId ? (
          <div className="bg-white p-3 rounded-lg shadow-xl border border-amber-400 w-64 rotate-3 opacity-90 cursor-grabbing">
            <div className="font-bold text-slate-800">Moving Exam...</div>
            <div className="text-xs text-slate-500">
              Drop on another exam to swap
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
