import React, { useState, useMemo } from "react";
import { AppData, Teacher } from "../../../types";
import { Modal, Button, Input } from "../../../components/ui";
import { Users, Search, XCircle, CheckCircle, Settings2, Wand2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  viewType: "DAILY" | "WEEKLY";
  initialParams: { min: number; max: number; weeks?: number };
  onGenerate: (config: {
    numWeeks: number;
    minTeachers: number;
    maxTeachers: number;
    excludedTeacherIds: string[];
  }) => void;
}

export const DutyGeneratorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  viewType,
  initialParams,
  onGenerate,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [minTeachers, setMinTeachers] = useState(initialParams.min);
  const [maxTeachers, setMaxTeachers] = useState(initialParams.max);
  const [weeks, setWeeks] = useState(initialParams.weeks || 4);

  // Sync state if initialParams change (when modal opens)
  React.useEffect(() => {
    if (isOpen) {
      setMinTeachers(initialParams.min);
      setMaxTeachers(initialParams.max);
      setWeeks(initialParams.weeks || 4);
    }
  }, [isOpen, initialParams]);

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
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id],
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Roster Generation"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onGenerate({
                numWeeks: weeks,
                minTeachers,
                maxTeachers,
                excludedTeacherIds: excludedIds,
              })
            }
            icon={<Wand2 size={16} />}
          >
            Generate Roster
          </Button>
        </div>
      }
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
        {/* CONFIG SECTION */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Settings2 size={14} /> Basic Parameters
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Input
              label="Min Staff/Row"
              type="number"
              value={minTeachers}
              onChange={(e) => setMinTeachers(parseInt(e.target.value) || 1)}
            />
            <Input
              label="Max Staff/Row"
              type="number"
              value={maxTeachers}
              onChange={(e) => setMaxTeachers(parseInt(e.target.value) || 1)}
            />
            {viewType === "WEEKLY" && (
              <Input
                label="Number of Weeks"
                type="number"
                value={weeks}
                onChange={(e) => setWeeks(parseInt(e.target.value) || 1)}
              />
            )}
          </div>
        </div>

        {/* EXCLUSION SECTION */}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Users size={14} /> Staff Availability
              </h4>
              <p className="text-[10px] text-slate-500 mt-1">
                Select teachers to EXCLUDE from this rotation.
              </p>
            </div>
            <div className="text-[10px] font-bold text-slate-400">
              {excludedIds.length} Excluded
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              placeholder="Search staff..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
            {filteredTeachers.map((t) => {
              const isExcluded = excludedIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTeacher(t.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                    isExcluded
                      ? "bg-slate-50 border-slate-200 opacity-60"
                      : "bg-white border-transparent hover:border-amber-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isExcluded ? "bg-slate-200 text-slate-400" : "bg-amber-100 text-amber-700"}`}
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
