import React, { useState, useEffect } from "react";
import { School, Coffee, Utensils, Minus, Plus } from "lucide-react";
import { AppData, ClassGroup, PeriodType, CurriculumItem } from "../../types";
import { Button, Modal, Input, Select } from "../../components/ui";
import { generateId } from "../../utils/utils";
import { DAYS } from "../../utils/constants";

interface ClassEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingClass: ClassGroup | null;
  data: AppData;
  onSave: (cls: ClassGroup) => void;
}

export const ClassEditorModal: React.FC<ClassEditorModalProps> = ({
  isOpen,
  onClose,
  editingClass,
  data,
  onSave,
}) => {
  const [cName, setCName] = useState("");
  const [cDuration, setCDuration] = useState(50);
  const [cPeriodCount, setCPeriodCount] = useState(data.settings.periodsPerDay);
  const [cStructure, setCStructure] = useState<PeriodType[]>([]);
  const [cCurriculum, setCCurriculum] = useState<CurriculumItem[]>([]);

  // New State for Class-Specific Reservations
  const [cFixedSessions, setCFixedSessions] = useState<(string | null)[][]>([]);
  const [activeSlot, setActiveSlot] = useState<{ d: number; p: number } | null>(
    null
  );
  const [slotLabel, setSlotLabel] = useState("");

  const [modalSubTab, setModalSubTab] = useState<"BASICS" | "STRUCTURE">(
    "BASICS"
  );

  // Hydrate state when modal opens or editingClass changes
  useEffect(() => {
    if (isOpen) {
      setCName(editingClass?.name || "");
      setCDuration(
        editingClass?.duration || data.settings.defaultClassDuration || 50
      );
      const targetCount =
        editingClass?.periodCount || data.settings.periodsPerDay;
      setCPeriodCount(targetCount);

      // 1. Structure Logic
      const defaultStruct = data.settings.dayStructure.map(
        (s) => s.type || "CLASS"
      );
      let initialStruct: PeriodType[] = [];

      if (editingClass?.structure && editingClass.structure.length > 0) {
        initialStruct = editingClass.structure.map(
          (s) => (typeof s === "object" ? s.type : s) || "CLASS"
        );
      } else {
        initialStruct = [...defaultStruct];
      }

      // Resize Structure
      if (initialStruct.length < targetCount) {
        const diff = targetCount - initialStruct.length;
        initialStruct = [...initialStruct, ...Array(diff).fill("CLASS")];
      } else if (initialStruct.length > targetCount) {
        initialStruct = initialStruct.slice(0, targetCount);
      }
      setCStructure(initialStruct);

      // 2. Fixed Sessions Logic (New)
      // Initialize with nulls
      const initialFixed = Array(5)
        .fill(null)
        .map(() => Array(targetCount).fill(null));

      // Hydrate from existing class data if available
      if (editingClass?.fixedSessions) {
        editingClass.fixedSessions.forEach((row, d) => {
          if (d < 5) {
            row.forEach((val, p) => {
              if (p < targetCount) initialFixed[d][p] = val;
            });
          }
        });
      }
      setCFixedSessions(initialFixed);

      // 3. Curriculum Logic
      const existingCurr = editingClass?.curriculum || [];
      const fullCurr = data.subjects.map((subj) => {
        const existing = existingCurr.find((c) => c.subjectId === subj.id);
        return existing
          ? { ...existing }
          : {
              id: generateId(),
              subjectId: subj.id,
              periodsPerWeek: 0,
              doubles: 0,
              singles: 0,
              assignedTeacherId: undefined,
            };
      });
      setCCurriculum(fullCurr as CurriculumItem[]);
      setModalSubTab("BASICS");
    }
  }, [isOpen, editingClass, data.settings, data.subjects]);

  const handlePeriodCountChange = (val: number) => {
    setCPeriodCount(val);

    // Resize Structure
    if (val > cStructure.length) {
      setCStructure([
        ...cStructure,
        ...Array(val - cStructure.length).fill("CLASS"),
      ]);
    } else {
      setCStructure(cStructure.slice(0, val));
    }

    // Resize Fixed Sessions
    const newFixed = cFixedSessions.map((row) => {
      if (val > row.length)
        return [...row, ...Array(val - row.length).fill(null)];
      return row.slice(0, val);
    });
    setCFixedSessions(newFixed);
  };

  const saveSlotLabel = () => {
    if (!activeSlot) return;
    const copy = [...cFixedSessions];
    // Ensure row exists logic (safe-guard)
    if (!copy[activeSlot.d]) copy[activeSlot.d] = [];

    copy[activeSlot.d][activeSlot.p] = slotLabel || null;
    setCFixedSessions(copy);
    setActiveSlot(null);
    setSlotLabel("");
  };

  const handleSave = () => {
    if (!cName) return;
    const activeCurriculum = cCurriculum.filter((c) => c.periodsPerWeek > 0);

    // Map structure back to PeriodConfig[]
    const finalStructure = cStructure.map((type, i) => {
      const globalLabel = data.settings.dayStructure[i]?.label;
      const globalType = data.settings.dayStructure[i]?.type;

      let label = globalLabel || `${i + 1}`;
      if (type !== globalType) {
        if (type === "BREAK") label = "Break";
        else if (type === "LUNCH") label = "Lunch";
        else label = `${i + 1}`;
      }

      return { type, label };
    });

    const newClass: ClassGroup = {
      id: editingClass ? editingClass.id : generateId(),
      name: cName,
      periodCount: cPeriodCount,
      duration: cDuration,
      structure: finalStructure,
      fixedSessions: cFixedSessions, // Save the reservations
      curriculum: activeCurriculum,
    };
    onSave(newClass);
    onClose();
  };

  const renderStructureEditor = () => (
    <div className="space-y-4 animate-in fade-in">
      <p className="text-xs text-slate-500 bg-blue-50 p-3 rounded border border-blue-100">
        <span className="font-bold">Instructions:</span> Click any block below
        to toggle it between <b>Class</b>, <b>Break</b>, or <b>Lunch</b>. This
        overrides the global schedule for this specific class only.
      </p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
      >
        {cStructure.map((type, idx) => (
          <button
            key={idx}
            onClick={() => {
              const types: PeriodType[] = ["CLASS", "BREAK", "LUNCH"];
              const next = types[(types.indexOf(type) + 1) % 3];
              const newStruct = [...cStructure];
              newStruct[idx] = next;
              setCStructure(newStruct);
            }}
            className={`
                      p-3 rounded-lg border text-center text-xs font-bold transition-all relative overflow-hidden group
                      ${
                        type === "CLASS"
                          ? "bg-white border-slate-300 text-slate-700 hover:border-blue-400"
                          : ""
                      }
                      ${
                        type === "BREAK"
                          ? "bg-amber-50 border-amber-300 text-amber-700"
                          : ""
                      }
                      ${
                        type === "LUNCH"
                          ? "bg-orange-50 border-orange-300 text-orange-700"
                          : ""
                      }
                  `}
          >
            <div className="absolute top-1 left-1 text-[9px] text-slate-400 font-normal opacity-50">
              {idx + 1}
            </div>
            <div className="mt-1">
              {type === "CLASS" && (
                <School size={16} className="mx-auto mb-1" />
              )}
              {type === "BREAK" && (
                <Coffee size={16} className="mx-auto mb-1" />
              )}
              {type === "LUNCH" && (
                <Utensils size={16} className="mx-auto mb-1" />
              )}
              {type || "CLASS"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingClass ? `Edit ${editingClass.name}` : "New Class Group"}
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col h-[70vh]">
        {/* Modal Body with Scroll */}
        <div className="flex-1 flex flex-col lg:flex-row gap-8 overflow-hidden min-h-0">
          <div className="w-full lg:w-1/3 space-y-4 border-r border-slate-100 pr-4 overflow-y-auto custom-scrollbar">
            {/* Internal Tabs for Modal */}
            <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-lg sticky top-0 z-10">
              <button
                onClick={() => setModalSubTab("BASICS")}
                className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${
                  modalSubTab === "BASICS"
                    ? "bg-white shadow text-slate-800"
                    : "text-slate-500"
                }`}
              >
                Basics
              </button>
              <button
                onClick={() => setModalSubTab("STRUCTURE")}
                className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${
                  modalSubTab === "STRUCTURE"
                    ? "bg-white shadow text-slate-800"
                    : "text-slate-500"
                }`}
              >
                Structure
              </button>
            </div>

            {modalSubTab === "BASICS" ? (
              <div className="space-y-6">
                <Input
                  label="Class Name"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder="e.g. Grade 10A"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="Periods/Day"
                      type="number"
                      value={cPeriodCount}
                      onChange={(e) =>
                        handlePeriodCountChange(parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <Input
                    label="Duration (min)"
                    type="number"
                    value={cDuration}
                    onChange={(e) =>
                      setCDuration(parseInt(e.target.value) || 0)
                    }
                  />
                </div>

                {/* RESERVATIONS GRID */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">
                      Class-Specific Events
                    </label>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-lg p-2 bg-slate-50 shadow-inner">
                    <div
                      className="grid gap-1 min-w-max"
                      style={{
                        gridTemplateColumns: `40px repeat(${cPeriodCount}, 1fr)`,
                      }}
                    >
                      {/* Header */}
                      <div className="text-right pr-2 text-[9px] font-bold text-slate-400 self-end pb-1">
                        Day
                      </div>
                      {Array.from({ length: cPeriodCount }).map((_, i) => (
                        <div
                          key={i}
                          className="text-center text-[9px] font-bold text-slate-400"
                        >
                          P{i + 1}
                        </div>
                      ))}

                      {/* Body */}
                      {DAYS.map((d, dIdx) => (
                        <React.Fragment key={d}>
                          <div className="text-right text-[10px] font-bold text-slate-600 pr-2 uppercase self-center">
                            {d.substring(0, 3)}
                          </div>
                          {Array.from({ length: cPeriodCount }).map(
                            (_, pIdx) => {
                              // Check Global First
                              let globalLabel: any =
                                data.settings.fixedOccasions[dIdx]?.[pIdx];
                              if (globalLabel === true)
                                globalLabel = "Reserved";

                              // Check Local
                              const localLabel = cFixedSessions[dIdx]?.[pIdx];
                              const displayLabel = localLabel || globalLabel;
                              const isGlobal = !!globalLabel;

                              return (
                                <button
                                  key={pIdx}
                                  onClick={() => {
                                    if (isGlobal) return;
                                    setSlotLabel(localLabel || "");
                                    setActiveSlot({ d: dIdx, p: pIdx });
                                  }}
                                  disabled={isGlobal}
                                  title={displayLabel || "Available"}
                                  className={`
                                                        h-6 rounded border text-[8px] font-bold truncate px-0.5 transition-all
                                                        ${
                                                          isGlobal
                                                            ? "bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed"
                                                            : localLabel
                                                            ? "bg-amber-100 text-amber-700 border-amber-300"
                                                            : "bg-white border-slate-200 hover:border-amber-400"
                                                        }
                                                    `}
                                >
                                  {displayLabel
                                    ? displayLabel.substring(0, 4)
                                    : "+"}
                                </button>
                              );
                            }
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    Grey = Global Event (Locked). Amber = Class Event.
                  </p>
                </div>
              </div>
            ) : (
              renderStructureEditor()
            )}
          </div>

          {/* Curriculum Matrix */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-2 shrink-0">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Curriculum
              </label>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {cCurriculum.map((item) => {
                const subject = data.subjects.find(
                  (s) => s.id === item.subjectId
                );
                if (!subject) return null;
                const eligibleTeachers = data.teachers.filter((t) =>
                  t.specialtyIds.includes(subject.id)
                );

                const updateItem = (f: keyof CurriculumItem, v: any) => {
                  setCCurriculum((prev) =>
                    prev.map((p) =>
                      p.subjectId === item.subjectId
                        ? {
                            ...p,
                            [f]: v,
                            periodsPerWeek:
                              f === "doubles"
                                ? v * 2 + p.singles
                                : f === "singles"
                                ? p.doubles * 2 + v
                                : p.periodsPerWeek,
                          }
                        : p
                    )
                  );
                };
                return (
                  <div
                    key={item.subjectId}
                    className={`flex flex-col p-3 rounded border transition-colors ${
                      item.periodsPerWeek > 0
                        ? "bg-white border-slate-300 shadow-sm"
                        : "bg-slate-50 border-slate-100 opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div
                          className="w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: subject.color }}
                        ></div>
                        <div className="font-bold text-sm text-slate-800">
                          {subject.name}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-400">
                        Total: {item.periodsPerWeek}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-slate-100 rounded border border-slate-200">
                        <button
                          onClick={() =>
                            updateItem("doubles", Math.max(0, item.doubles - 1))
                          }
                          className="px-2 py-1 hover:bg-slate-200 text-slate-600 font-bold"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-bold w-6 text-center border-x border-slate-200 bg-white py-1">
                          {item.doubles}
                        </span>
                        <button
                          onClick={() =>
                            updateItem("doubles", item.doubles + 1)
                          }
                          className="px-2 py-1 hover:bg-slate-200 text-slate-600 font-bold"
                        >
                          <Plus size={12} />
                        </button>
                        <span className="text-[9px] text-slate-400 uppercase font-bold px-1.5 border-l border-slate-200">
                          Dbl
                        </span>
                      </div>
                      <div className="flex items-center bg-slate-100 rounded border border-slate-200">
                        <button
                          onClick={() =>
                            updateItem("singles", Math.max(0, item.singles - 1))
                          }
                          className="px-2 py-1 hover:bg-slate-200 text-slate-600 font-bold"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-bold w-6 text-center border-x border-slate-200 bg-white py-1">
                          {item.singles}
                        </span>
                        <button
                          onClick={() =>
                            updateItem("singles", item.singles + 1)
                          }
                          className="px-2 py-1 hover:bg-slate-200 text-slate-600 font-bold"
                        >
                          <Plus size={12} />
                        </button>
                        <span className="text-[9px] text-slate-400 uppercase font-bold px-1.5 border-l border-slate-200">
                          Sgl
                        </span>
                      </div>
                    </div>

                    {item.periodsPerWeek > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <Select
                          value={item.assignedTeacherId || ""}
                          onChange={(e) =>
                            updateItem(
                              "assignedTeacherId",
                              e.target.value || null
                            )
                          }
                          options={[
                            { value: "", label: "Unassigned" },
                            ...eligibleTeachers.map((t) => ({
                              value: t.id,
                              label: t.name,
                            })),
                          ]}
                          className="text-xs py-1"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Class</Button>
        </div>
      </div>

      {/* Mini Modal for Slot Label */}
      {activeSlot && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-2xl">
          <div className="bg-white p-4 rounded-xl shadow-xl w-64 space-y-3 animate-in zoom-in-95">
            <h4 className="font-bold text-sm text-slate-800">Reserve Slot</h4>
            <Input
              autoFocus
              placeholder="e.g. Worship"
              value={slotLabel}
              onChange={(e) => setSlotLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveSlotLabel()}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  setSlotLabel("");
                  saveSlotLabel();
                }}
              >
                Clear
              </Button>
              <Button size="sm" onClick={saveSlotLabel}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
