import React, { useMemo, useState } from "react";
import { AppData, ExamSession } from "../../../types";
import {
  AlertTriangle,
  Clock,
  MapPin,
  GripVertical,
  CalendarDays,
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
  exam,
  data,
  conflicts,
  onEdit,
}: {
  exam: ExamSession;
  data: AppData;
  conflicts: string[];
  onEdit: (e: ExamSession) => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: exam.id,
    data: { type: "EXAM", exam },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: exam.id,
    data: { type: "EXAM_TARGET", exam },
  });

  const subject = data.subjects.find((s) => s.id === exam.subjectId);
  const room = data.rooms.find((r) => r.id === exam.roomId);
  const hasRoom = !!exam.roomId;

  // Combine refs for swap capability
  const setRefs = (node: HTMLElement | null) => {
    setNodeRef(node);
    setDropRef(node);
  };

  if (isDragging) {
    return (
      <div
        ref={setRefs}
        className="opacity-30 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg h-32"
      />
    );
  }

  return (
    <div
      ref={setRefs}
      style={{
        borderLeftColor: conflicts.length > 0 ? undefined : subject?.color,
        transform: isDragging ? "scale(1.05)" : "scale(1)",
      }}
      className={`
        relative group bg-white rounded-lg border-l-4 shadow-sm hover:shadow-md transition-all p-3
        ${
          conflicts.length > 0
            ? "border-l-red-500 border-red-200 bg-red-50/10"
            : ""
        }
        ${conflicts.length === 0 ? "border-slate-200" : ""}
        ${isOver ? "ring-2 ring-amber-400 bg-amber-50" : ""}
      `}
    >
      {/* Drag Handle */}
      <div
        {...listeners}
        {...attributes}
        className="absolute top-2 right-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
      >
        <GripVertical size={14} />
      </div>

      {/* Edit Trigger (Clicking body) */}
      <div onClick={() => onEdit(exam)} className="cursor-pointer">
        {/* Conflict Badge */}
        {conflicts.length > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm z-10 animate-pulse">
            <AlertTriangle size={12} />
          </div>
        )}

        {/* Time Header */}
        <div className="flex justify-between items-start mb-2 pr-4">
          <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
            <Clock size={10} />
            {exam.startTime}{" "}
            <span className="font-normal text-slate-400">
              ({exam.duration}m)
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            {exam.paperLabel || `P${exam.paperNumber}`}
          </span>
        </div>

        {/* Subject Info */}
        <div className="mb-3">
          <h4
            className="font-bold text-slate-800 text-sm truncate"
            title={subject?.name}
          >
            {subject?.name || "Unknown Subject"}
          </h4>
        </div>

        {/* Room Info */}
        <div
          className={`
          flex items-center gap-2 text-[11px] font-medium pt-2 border-t border-dashed
          ${
            hasRoom
              ? "text-slate-600 border-slate-100"
              : "text-amber-600 border-amber-100"
          }
        `}
        >
          <MapPin
            size={12}
            className={hasRoom ? "text-slate-400" : "text-amber-500"}
          />
          {hasRoom ? (
            <span className="truncate">{room?.name}</span>
          ) : (
            <span className="italic flex-1">Assign Room</span>
          )}
        </div>
      </div>
    </div>
  );
};

// 2. Droppable Day Column Header
const DroppableDayHeader = ({
  date,
  count,
}: {
  date: string;
  count: number;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `date-${date}`,
    data: { type: "DATE_TARGET", date },
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
        ${isOver ? "bg-indigo-50 border-indigo-300" : "border-slate-200"}
      `}
    >
      <div
        className={`p-1.5 rounded-full ${
          isOver
            ? "bg-indigo-100 text-indigo-600"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        <CalendarDays size={16} />
      </div>
      <div>
        <h3
          className={`text-lg font-bold ${
            isOver ? "text-indigo-700" : "text-slate-800"
          }`}
        >
          {formatDate(date)}
        </h3>
        {isOver && (
          <span className="text-[10px] text-indigo-500 font-bold block">
            Drop to move here
          </span>
        )}
      </div>
      {!isOver && (
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full ml-auto">
          {count} Exams
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
  onSwap: (id1: string, id2: string) => void; // NEW PROP
  onMoveDate: (id: string, date: string) => void; // NEW PROP
}

export const ExamGrid: React.FC<Props> = ({
  data,
  exams,
  onEdit,
  checkConflicts,
  onSwap,
  onMoveDate,
}) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Grouping Logic
  const groupedExams = useMemo(() => {
    const groups: Record<string, ExamSession[]> = {};
    exams.forEach((exam) => {
      if (!groups[exam.date]) groups[exam.date] = [];
      groups[exam.date].push(exam);
    });
    return Object.keys(groups)
      .sort()
      .map((date) => ({
        date,
        sessions: groups[date].sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        ),
      }));
  }, [exams]);

  // Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Case 1: Dropped onto another Exam (SWAP)
    if (activeId !== overId && over.data.current?.type === "EXAM_TARGET") {
      if (confirm("Swap these two exams?")) {
        onSwap(activeId, overId);
      }
    }

    // Case 2: Dropped onto a Day Header (MOVE DATE)
    if (over.data.current?.type === "DATE_TARGET") {
      const newDate = over.data.current.date;
      const currentExam = exams.find((e) => e.id === activeId);

      if (currentExam && currentExam.date !== newDate) {
        onMoveDate(activeId, newDate);
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
              count={group.sessions.length}
            />

            {/* Grid of Draggable Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {group.sessions.map((exam) => (
                <DraggableExamCard
                  key={exam.id}
                  exam={exam}
                  data={data}
                  conflicts={checkConflicts(exam)}
                  onEdit={onEdit}
                />
              ))}

              {/* Empty State placeholder for drop zones if needed */}
              {group.sessions.length === 0 && (
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
