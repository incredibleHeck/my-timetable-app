import React, { useState, useMemo } from "react";
import { AppData, Teacher } from "../../../types";
import { Modal, Button, Input } from "../../../components/ui";
import { Users, Search, XCircle, CheckCircle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  onConfirm: (excludedIds: string[]) => void;
}

export const InvigilatorExclusionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  onConfirm,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  const sortedTeachers = useMemo(() => {
    return [...data.teachers].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.teachers]);

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return sortedTeachers;
    const q = searchQuery.toLowerCase();
    return sortedTeachers.filter((t) => t.name.toLowerCase().includes(q));
  }, [sortedTeachers, searchQuery]);

  const toggleTeacher = (id: string) => {
    setExcludedIds((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setExcludedIds([]);
  };

  const handleExcludeAll = () => {
    setExcludedIds(data.teachers.map((t) => t.id));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Staff Availability"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(excludedIds)}>
            Confirm & Assign
          </Button>
        </div>
      }
    >
      <div className="space-y-4 max-h-[60vh] flex flex-col">
        <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex items-start gap-3">
          <Users className="text-amber-600 shrink-0" size={18} />
          <div>
            <p className="text-xs font-bold text-amber-800">
              Exclude Staff Members
            </p>
            <p className="text-[10px] text-amber-700 mt-0.5">
              Uncheck teachers who should NOT be assigned. During exams, teaching
              stops — all other staff can invigilate. Use the min–max range on
              the toolbar for how many invigilators each stream gets per day.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
            <input
              placeholder="Search teachers..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="secondary" size="sm" onClick={handleSelectAll}>
            Include All
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl custom-scrollbar p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {filteredTeachers.map((t) => {
              const isExcluded = excludedIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTeacher(t.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                    isExcluded
                      ? "bg-slate-50 border-slate-200 opacity-60"
                      : "bg-white border-transparent hover:border-amber-200 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        isExcluded
                          ? "bg-slate-200 text-slate-400"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">{t.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {isExcluded ? "Excluded" : "Available"}
                      </p>
                    </div>
                  </div>
                  {isExcluded ? (
                    <XCircle size={18} className="text-slate-300" />
                  ) : (
                    <CheckCircle size={18} className="text-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};
