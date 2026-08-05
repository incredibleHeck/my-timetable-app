import React, { useState, useEffect, useMemo } from "react";
import { Check } from "lucide-react";
import { AppData } from "../../../types";
import { Teacher } from "../types";
import { Button, Modal, controlClass } from "../../../components/ui";
import { generateId } from "../../../utils/utils";
import { AvailabilityGrid, AvailabilityTemplate } from "./AvailabilityGrid";

interface TeacherEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTeacher: Teacher | null;
  data: AppData;
  onSave: (teacher: Teacher) => void;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ id, label, hint, children }) => (
  <div className="min-w-0">
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-content">
      {label}
    </label>
    {children}
    {hint && <p className="mt-1 text-2xs text-content-muted">{hint}</p>}
  </div>
);

export const TeacherEditorModal: React.FC<TeacherEditorModalProps> = ({
  isOpen,
  onClose,
  editingTeacher,
  data,
  onSave,
}) => {
  const [tName, setTName] = useState("");
  const [tTargetLoad, setTTargetLoad] = useState("");
  const [tMaxPeriods, setTMaxPeriods] = useState("");
  const [tSpecialties, setTSpecialties] = useState<string[]>([]);
  const [tConstraints, setTConstraints] = useState<boolean[][]>([]);

  const globalMaxDaily = data.settings.maxTeacherPeriodsPerDay ?? 6;
  const globalWeekly = data.settings.maxTeachingPeriodsPerWeek ?? 24;

  const maxClassPeriods = useMemo(
    () => Math.max(data.settings.periodsPerDay, ...data.classes.map((c) => c.periodCount || 0)),
    [data.settings.periodsPerDay, data.classes],
  );

  const sortedSubjects = useMemo(
    () => [...data.subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [data.subjects],
  );

  useEffect(() => {
    if (isOpen) {
      setTName(editingTeacher?.name || "");
      setTTargetLoad(editingTeacher?.targetLoad?.toString() || "");
      setTMaxPeriods(editingTeacher?.maxPeriodsPerDay?.toString() || "");
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
    if (!tName.trim()) return;
    onSave({
      id: editingTeacher ? editingTeacher.id : generateId(),
      name: tName.trim(),
      specialtyIds: tSpecialties,
      constraints: tConstraints,
      targetLoad: parseInt(tTargetLoad) || undefined,
      maxPeriodsPerDay: parseInt(tMaxPeriods) || undefined,
    });
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

  const applyTemplate = (type: AvailabilityTemplate) => {
    const pCount = maxClassPeriods;
    const midPoint = Math.floor(pCount / 2);

    if (type === "CLEAR") {
      setTConstraints(
        Array(5)
          .fill(null)
          .map(() => Array(pCount).fill(false)),
      );
      return;
    }

    const n = tConstraints.map((row) => [...row]);
    for (let d = 0; d < 5; d++) {
      for (let p = 0; p < pCount; p++) {
        if (type === "MORNINGS") n[d][p] = p >= midPoint;
        if (type === "AFTERNOONS") n[d][p] = p < midPoint;
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
      maxWidth="max-w-4xl"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!tName.trim()}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Field id="teacher-name" label="Full name">
            <input
              id="teacher-name"
              className={`${controlClass} w-full`}
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              placeholder="John Doe"
              autoFocus
            />
          </Field>
          <Field id="teacher-target-load" label="Target load" hint={`Default ${globalWeekly}/week`}>
            <input
              id="teacher-target-load"
              type="number"
              className={`${controlClass} w-full`}
              value={tTargetLoad}
              onChange={(e) => setTTargetLoad(e.target.value)}
              placeholder={String(globalWeekly)}
            />
          </Field>
          <Field
            id="teacher-max-periods"
            label="Max periods per day"
            hint={`Default ${globalMaxDaily}/day`}
          >
            <input
              id="teacher-max-periods"
              type="number"
              className={`${controlClass} w-full`}
              value={tMaxPeriods}
              onChange={(e) => setTMaxPeriods(e.target.value)}
              placeholder={String(globalMaxDaily)}
            />
          </Field>
        </div>

        <div>
          <h4 className="text-sm font-medium text-content">Subjects</h4>
          <p className="mb-2 mt-0.5 text-xs text-content-muted">
            Determines which faculties this teacher belongs to and what the generator may assign
            them.
          </p>
          {sortedSubjects.length === 0 ? (
            <p className="rounded-md border border-dashed border-edge px-3 py-4 text-center text-xs text-content-muted">
              No subjects defined yet — add them in the Subjects library first.
            </p>
          ) : (
            <div className="custom-scrollbar flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
              {sortedSubjects.map((s) => {
                const isSelected = tSpecialties.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      setTSpecialties((p) =>
                        p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id],
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs
                                transition-colors focus-visible:outline-none focus-visible:ring-2
                                focus-visible:ring-accent focus-visible:ring-offset-2
                                focus-visible:ring-offset-surface ${
                                  isSelected
                                    ? "border-accent bg-accent/15 font-medium text-content"
                                    : "border-edge text-content-secondary hover:border-edge-strong"
                                }`}
                  >
                    {isSelected ? (
                      <Check size={11} className="text-accent-ink" aria-hidden />
                    ) : (
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: s.color }}
                      />
                    )}
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <AvailabilityGrid
          data={data}
          periodCount={maxClassPeriods}
          constraints={tConstraints}
          onToggleSlot={toggleConstraint}
          onToggleDay={toggleDay}
          onApplyTemplate={applyTemplate}
        />
      </div>
    </Modal>
  );
};
