import React, { useState, useMemo } from "react";
import { AppData, ExamSession } from "../../../types";
import { Modal, Button, Select, Input } from "../../../components/ui";
import { generateId } from "../../../utils/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  onSave: (sessions: ExamSession[]) => void;
}

export const ExamAutoModal: React.FC<Props> = ({ isOpen, onClose, data, onSave }) => {
  const [bulkClassId, setBulkClassId] = useState(data.classes[0]?.id || "");
  const [bulkSubjectIds, setBulkSubjectIds] = useState<string[]>([]);
  const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [bulkStartTime, setBulkStartTime] = useState("09:00");
  const [bulkDuration, setBulkDuration] = useState("120");
  const [bulkGap, setBulkGap] = useState("30");
  const [bulkExamsPerDay, setBulkExamsPerDay] = useState("1");

  const bulkClassCurriculum = useMemo(() => {
    const cls = data.classes.find(c => c.id === bulkClassId);
    return cls?.curriculum || [];
  }, [bulkClassId, data.classes]);

  const handleBulkGenerate = () => {
    if (!bulkClassId || bulkSubjectIds.length === 0 || !bulkStartDate) return;

    const newSessions: ExamSession[] = [];
    let currentDate = new Date(bulkStartDate);
    let examsToday = 0;
    const perDay = parseInt(bulkExamsPerDay) || 1;
    const gapMins = parseInt(bulkGap) || 0;
    const durationMins = parseInt(bulkDuration) || 120;

    const addMinutes = (timeStr: string, mins: number) => {
      const [h, m] = timeStr.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m + mins);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    let currentStartTime = bulkStartTime;

    bulkSubjectIds.forEach((sid) => {
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const dateStr = currentDate.toISOString().split("T")[0];
      
      newSessions.push({
        id: generateId(),
        subjectId: sid,
        classIds: [bulkClassId],
        roomId: "any", // Rooms no longer matter
        date: dateStr,
        startTime: currentStartTime,
        duration: durationMins,
      });

      examsToday++;
      if (examsToday >= perDay) {
        examsToday = 0;
        currentDate.setDate(currentDate.getDate() + 1);
        currentStartTime = bulkStartTime;
      } else {
        currentStartTime = addMinutes(currentStartTime, durationMins + gapMins);
      }
    });

    onSave(newSessions);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Auto-Schedule Exams"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleBulkGenerate}>Generate Timetable</Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Select
          label="Target Class Group"
          value={bulkClassId}
          onChange={(e) => {
            setBulkClassId(e.target.value);
            setBulkSubjectIds([]);
          }}
          options={data.classes.map(c => ({ value: c.id, label: c.name }))}
        />

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Examinable Subjects</label>
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-48 overflow-y-auto custom-scrollbar">
            {bulkClassCurriculum.map(item => {
              const s = data.subjects.find(sub => sub.id === item.subjectId);
              if (!s) return null;
              const isSelected = bulkSubjectIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setBulkSubjectIds(prev => isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold border transition-all ${isSelected ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Start Date" type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} />
          <Input label="Exam Start Time" type="time" value={bulkStartTime} onChange={(e) => setBulkStartTime(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Duration (min)" type="number" value={bulkDuration} onChange={(e) => setBulkDuration(e.target.value)} />
          <Input label="Gap between Exams (min)" type="number" value={bulkGap} onChange={(e) => setBulkGap(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Exams per Day" type="number" min="1" max="3" value={bulkExamsPerDay} onChange={(e) => setBulkExamsPerDay(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
};
