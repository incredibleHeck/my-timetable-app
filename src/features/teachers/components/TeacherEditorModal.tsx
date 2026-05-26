import React, { useState, useEffect, useMemo } from "react";
import {
  Sun,
  Moon,
  Calendar,
  XSquare,
  Ban,
  Coffee,
  Utensils,
} from "lucide-react";
import { AppData } from "../../../types";
import { Teacher } from "../types";
import { Button, Modal, Input } from "../../../components/ui";
import { DAYS } from "../../../utils/constants";
import { generateId } from "../../../utils/utils";

interface TeacherEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTeacher: Teacher | null;
  data: AppData;
  onSave: (teacher: Teacher) => void;
}

export const TeacherEditorModal: React.FC<TeacherEditorModalProps> = ({
  isOpen,
  onClose,
  editingTeacher,
  data,
  onSave,
}) => {
  const [tName, setTName] = useState("");
  const [tSpecialties, setTSpecialties] = useState<string[]>([]);
  const [tConstraints, setTConstraints] = useState<boolean[][]>([]);

  const maxClassPeriods = useMemo(
    () =>
      Math.max(
        data.settings.periodsPerDay,
        ...data.classes.map((c) => c.periodCount || 0)
      ),
    [data.settings.periodsPerDay, data.classes]
  );

  const sortedSubjects = useMemo(
    () => [...data.subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [data.subjects]
  );

  useEffect(() => {
    if (isOpen) {
      setTName(editingTeacher?.name || "");
      setTSpecialties(editingTeacher?.specialtyIds || []);

      const periods = maxClassPeriods;
      const initialC = Array(5)
        .fill(null)
        .map(() => Array(periods).fill(false));

      if (editingTeacher && editingTeacher.constraints) {
        editingTeacher.constraints.forEach((row, d) => {
          if (d < 5) {
            row.forEach((val, p) => {
              if (p < periods) initialC[d][p] = val;
            });
          }
        });
      }
      setTConstraints(initialC);
    }
  }, [isOpen, editingTeacher, maxClassPeriods]);

  const handleSave = () => {
    if (!tName) return;
    const newT: Teacher = {
      id: editingTeacher ? editingTeacher.id : generateId(),
      name: tName,
      specialtyIds: tSpecialties,
      constraints: tConstraints,
    };
    onSave(newT);
    onClose();
  };

  const toggleConstraint = (d: number, p: number) => {
    const n = tConstraints.map((row) => [...row]);
    n[d][p] = !n[d][p];
    setTConstraints(n);
  };

  const toggleDay = (d: number) => {
    const n = tConstraints.map((row) => [...row]);
    const allBlocked = n[d].every((x) => x);
    n[d] = n[d].map(() => !allBlocked);
    setTConstraints(n);
  };

  const applyTemplate = (
    type: "MORNINGS" | "AFTERNOONS" | "FRIDAYS" | "CLEAR"
  ) => {
    const n = tConstraints.map((row) => [...row]);
    const pCount = maxClassPeriods;
    const midPoint = Math.floor(pCount / 2);

    if (type === "CLEAR") {
      setTConstraints(
        Array(5)
          .fill(null)
          .map(() => Array(pCount).fill(false))
      );
      return;
    }

    for (let d = 0; d < 5; d++) {
      for (let p = 0; p < pCount; p++) {
        if (type === "MORNINGS" && p < midPoint) n[d][p] = false;
        if (type === "MORNINGS" && p >= midPoint) n[d][p] = true;

        if (type === "AFTERNOONS" && p < midPoint) n[d][p] = true;
        if (type === "AFTERNOONS" && p >= midPoint) n[d][p] = false;

        if (type === "FRIDAYS" && d === 4) n[d][p] = true;
      }
    }
    setTConstraints(n);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTeacher ? "Edit Teacher" : "Add New Teacher"}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Input
          label="Full Name"
          value={tName}
          onChange={(e) => setTName(e.target.value)}
          placeholder="e.g. John Doe"
          autoFocus
        />

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
            Subject Specialties
          </label>
          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-32 overflow-y-auto custom-scrollbar">
            {sortedSubjects.map((s) => (
              <button
                key={s.id}
                onClick={() =>
                  setTSpecialties((p) =>
                    p.includes(s.id)
                      ? p.filter((x) => x !== s.id)
                      : [...p, s.id]
                  )
                }
                className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${
                  tSpecialties.includes(s.id)
                    ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {s.name}
              </button>
            ))}
            {sortedSubjects.length === 0 && (
              <span className="text-xs text-slate-400 italic">
                No subjects defined. Go to Subjects library.
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Selecting subjects here adds this teacher to the corresponding
            Faculty. Weekly capacity is configured globally under Configuration
            → Max Teaching Periods / Week.
          </p>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="block text-xs font-bold text-slate-500 uppercase">
              Availability Constraints
            </label>
            <div className="flex gap-1">
              <button
                onClick={() => applyTemplate("MORNINGS")}
                className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold flex items-center gap-1"
              >
                <Sun size={10} /> Mornings Only
              </button>
              <button
                onClick={() => applyTemplate("AFTERNOONS")}
                className="text-[10px] px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 font-bold flex items-center gap-1"
              >
                <Moon size={10} /> Afternoons Only
              </button>
              <button
                onClick={() => applyTemplate("FRIDAYS")}
                className="text-[10px] px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold flex items-center gap-1"
              >
                <Calendar size={10} /> No Fridays
              </button>
              <button
                onClick={() => applyTemplate("CLEAR")}
                className="text-[10px] px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 font-bold flex items-center gap-1"
              >
                <XSquare size={10} /> Reset
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg p-4 bg-slate-50 shadow-inner">
            <div
              className="grid gap-1 min-w-[700px]"
              style={{
                gridTemplateColumns: `80px repeat(${maxClassPeriods}, 1fr)`,
              }}
            >
              <div className="text-right pr-2 text-[10px] font-bold text-slate-400 self-end pb-1">
                Day \ Per
              </div>
              {Array.from({ length: maxClassPeriods }).map((_, i) => {
                const config = data.settings.dayStructure[i];
                const label = config?.label || `${i + 1}`;
                const isBreak =
                  config?.type === "BREAK" || config?.type === "LUNCH";
                const icon =
                  config?.type === "LUNCH" ? (
                    <Utensils size={8} />
                  ) : config?.type === "BREAK" ? (
                    <Coffee size={8} />
                  ) : null;

                return (
                  <div
                    key={i}
                    className={`text-center text-[9px] font-bold rounded py-1 flex flex-col items-center justify-center h-8 leading-tight ${
                      isBreak
                        ? "bg-orange-100 text-orange-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {icon}
                    <span>{label}</span>
                  </div>
                );
              })}

              {DAYS.map((d, dIdx) => (
                <React.Fragment key={d}>
                  <button
                    onClick={() => toggleDay(dIdx)}
                    className="text-right text-xs font-bold text-slate-600 pr-3 hover:text-amber-600 transition-colors uppercase tracking-wider h-9 flex items-center justify-end"
                    title="Toggle Entire Day"
                  >
                    {d.substring(0, 3)}
                  </button>
                  {Array.from({ length: maxClassPeriods }).map((_, pIdx) => {
                    const isBlocked = tConstraints[dIdx]?.[pIdx];
                    const globalType = data.settings.dayStructure[pIdx]?.type;
                    const isGlobalBreak =
                      globalType === "BREAK" || globalType === "LUNCH";

                    return (
                      <button
                        key={pIdx}
                        onClick={() => toggleConstraint(dIdx, pIdx)}
                        className={`h-9 rounded-md border flex items-center justify-center transition-all duration-200 text-[9px] font-bold 
                                ${
                                  isBlocked
                                    ? "bg-red-500 border-red-600 shadow-inner"
                                    : isGlobalBreak
                                    ? "bg-amber-50 border-dashed border-amber-300"
                                    : "bg-white border-slate-200 hover:border-amber-400 hover:shadow-sm"
                                }`}
                        title={
                          isBlocked
                            ? "Blocked"
                            : isGlobalBreak
                            ? "Available (Teaching during Break)"
                            : "Available"
                        }
                      >
                        {isBlocked && (
                          <Ban
                            size={16}
                            className="text-white animate-in zoom-in duration-200"
                          />
                        )}
                        {!isBlocked && isGlobalBreak && (
                          <span className="text-amber-400/50 uppercase tracking-tighter">
                            Open
                          </span>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="flex gap-4 mt-2 justify-end">
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <div className="w-3 h-3 bg-white border border-slate-200 rounded"></div>{" "}
              Available
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <div className="w-3 h-3 bg-amber-50 border border-dashed border-amber-300 rounded"></div>{" "}
              Teaching during Break
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <div className="w-3 h-3 bg-red-500 border border-red-600 rounded"></div>{" "}
              Blocked
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
