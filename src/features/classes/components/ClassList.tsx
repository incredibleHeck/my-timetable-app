import React from "react";
import { Clock, Copy, Trash2, Plus } from "lucide-react";
import { AppData } from "../../../types";
import { ClassGroup } from "../types";
import { Button } from "../../../components/ui";
import { useClassMetrics } from "../hooks/useClassMetrics";

interface ClassListProps {
  data: AppData;
  onEdit: (cls: ClassGroup) => void;
  onDuplicate: (cls: ClassGroup) => void;
  onDelete: (cls: ClassGroup) => void;
  onAdd: () => void;
}

export const ClassList: React.FC<ClassListProps> = ({
  data,
  onEdit,
  onDuplicate,
  onDelete,
  onAdd,
}) => {
  const { getLoadMetrics } = useClassMetrics(data);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in slide-in-from-bottom-2">
      {[...data.classes]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map((c) => {
          const { assigned, capacity } = getLoadMetrics(c);
          const loadPercent = capacity > 0 ? (assigned / capacity) * 100 : 0;
          const isOverloaded = assigned > capacity;
          const isFull = assigned === capacity;

          return (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group relative"
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{c.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <Clock size={12} /> {c.duration} mins
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                    {c.name.substring(0, 2).toUpperCase()}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Home Room</span>
                    <span
                      className="font-bold text-amber-600 truncate max-w-[100px]"
                      title={data.rooms.find((r) => r.id === c.defaultRoomId)?.name || "Unassigned"}
                    >
                      {data.rooms.find((r) => r.id === c.defaultRoomId)?.name || "Unassigned"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Periods/Day</span>
                    <span className="font-bold text-slate-700">{c.periodCount}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Subjects</span>
                    <span className="font-bold text-slate-700">{c.curriculum.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Weekly Load</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isOverloaded ? "bg-red-500" : isFull ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(loadPercent, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`font-bold ${
                          isOverloaded
                            ? "text-red-600"
                            : isFull
                              ? "text-amber-600"
                              : "text-slate-700"
                        }`}
                      >
                        {assigned}/{capacity}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-100">
                  <Button
                    onClick={() => onEdit(c)}
                    variant="secondary"
                    size="sm"
                    className="flex-1 text-xs"
                  >
                    Edit
                  </Button>
                  <button
                    onClick={() => onDuplicate(c)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Duplicate Class"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(c)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete Class"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      <button
        onClick={onAdd}
        className="min-h-[200px] rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50 transition-all flex flex-col items-center justify-center p-6 text-slate-400 hover:text-amber-600"
      >
        <Plus size={32} className="mb-2" /> <span className="font-bold">Add Class</span>
      </button>
    </div>
  );
};
