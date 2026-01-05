import React, { useState, useMemo } from "react";
import { AppData, Teacher, DutyLocation, ClassGroup, DutyAssignment } from "../../../types";
import { Modal, Button, Select, Input } from "../../../components/ui";
import { Users, MapPin, Calendar, Clock, BookOpen, Plus } from "lucide-react";
import { generateId } from "../../../utils/utils";
import { DAYS } from "../../../utils/constants";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  onSave: (assignments: DutyAssignment[]) => void;
}

export const DutyBulkAssignModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  onSave,
}) => {
  const [selectedLocationId, setSelectedLocationId] = useState(data.dutyLocations?.[0]?.id || "");
  const [startDay, setStartDay] = useState(0);
  const [endDay, setEndDay] = useState(0);
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  const dutyPeriods = useMemo(() => {
    return data.settings.dayStructure
      .map((p, i) => ({ ...p, index: i }))
      .filter((p) => p.type === "BREAK" || p.type === "LUNCH");
  }, [data.settings.dayStructure]);

  const sortedTeachers = useMemo(() => {
    return [...data.teachers].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.teachers]);

  const sortedClasses = useMemo(() => {
    return [...data.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [data.classes]);

  const handlePeriodToggle = (idx: number) => {
    setSelectedPeriods(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleTeacherToggle = (id: string) => {
    setSelectedTeacherIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const handleApply = () => {
    if (!selectedLocationId) {
      alert("Please select a location.");
      return;
    }
    if (selectedTeacherIds.length === 0) {
      alert("Please select at least one teacher.");
      return;
    }
    if (selectedPeriods.length === 0) {
      alert("Please select at least one period.");
      return;
    }

    const newAssignments: DutyAssignment[] = [];

    for (let d = startDay; d <= endDay; d++) {
      for (const p of selectedPeriods) {
        for (const tId of selectedTeacherIds) {
          newAssignments.push({
            id: generateId(),
            locationId: selectedLocationId,
            teacherId: tId,
            classId: selectedClassId || undefined,
            day: d,
            period: p
          });
        }
      }
    }

    onSave(newAssignments);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Duty Assignment"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} icon={<Plus size={16} />}>Assign Range</Button>
        </div>
      }
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
        {/* Location Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Duty Location"
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            options={data.dutyLocations.map(l => ({ value: l.id, label: l.name }))}
          />
          <Select
            label="Associate with Class (Optional)"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            options={[{ value: "", label: "General Duty" }, ...sortedClasses.map(c => ({ value: c.id, label: c.name }))]}
          />
        </div>

        {/* Day Range Selection */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
            <Calendar size={14} /> Day Range
          </h4>
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <Select
              label="Start Day"
              value={startDay.toString()}
              onChange={(e) => setStartDay(parseInt(e.target.value))}
              options={DAYS.map((d, i) => ({ value: i.toString(), label: d }))}
            />
            <Select
              label="End Day"
              value={endDay.toString()}
              onChange={(e) => setEndDay(parseInt(e.target.value))}
              options={DAYS.map((d, i) => ({ value: i.toString(), label: d }))}
            />
          </div>
        </div>

        {/* Period Selection */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
            <Clock size={14} /> Select Periods
          </h4>
          <div className="flex flex-wrap gap-2">
            {dutyPeriods.map((p) => (
              <button
                key={p.index}
                onClick={() => handlePeriodToggle(p.index)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border ${
                  selectedPeriods.includes(p.index)
                    ? "bg-amber-500 border-amber-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {p.label} ({p.type})
              </button>
            ))}
          </div>
        </div>

        {/* Teacher Selection */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
              <Users size={14} /> Assign Teachers
            </h4>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {selectedTeacherIds.length} Selected
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50/30 max-h-48 overflow-y-auto custom-scrollbar">
            {sortedTeachers.map((t) => (
              <label
                key={t.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[10px] cursor-pointer select-none transition-all ${
                  selectedTeacherIds.includes(t.id)
                    ? "bg-white border-amber-300 text-amber-900 shadow-sm ring-1 ring-amber-100"
                    : "border-transparent hover:bg-white hover:border-slate-200 text-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selectedTeacherIds.includes(t.id)}
                  onChange={() => handleTeacherToggle(t.id)}
                />
                <div className={`w-1.5 h-1.5 rounded-full ${selectedTeacherIds.includes(t.id) ? "bg-amber-500" : "bg-slate-300"}`} />
                <span className="truncate">{t.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
