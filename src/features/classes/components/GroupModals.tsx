import React, { useState } from "react";
import { Subject, Teacher } from "../../../types";
import { JointClass, ElectiveBlock, ClassGroup } from "../types";
import { Button, Modal, controlClass } from "../../../components/ui";
import { generateId } from "../../../utils/utils";

interface FieldProps {
  id: string;
  label: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ id, label, children }) => (
  <div className="min-w-0">
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-content">
      {label}
    </label>
    {children}
  </div>
);

interface PickerProps<T extends { id: string; name: string; color?: string }> {
  legend: string;
  /** Shown under the legend; states the rule the Create button enforces. */
  requirement: string;
  items: T[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

/**
 * Checkbox list in a fieldset. The previous version was a bare bordered div of
 * unlabelled checkboxes, and the Create button stayed enabled while silently
 * doing nothing until enough boxes were ticked — the rule was never stated.
 */
function Picker<T extends { id: string; name: string; color?: string }>({
  legend,
  requirement,
  items,
  selectedIds,
  onToggle,
}: PickerProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium text-content">{legend}</legend>
      <p className="mb-2 text-xs text-content-muted">
        {requirement}
        {selectedIds.length > 0 && (
          <span className="tabular-nums"> · {selectedIds.length} selected</span>
        )}
      </p>
      <div className="custom-scrollbar grid max-h-44 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-md border border-edge p-2.5">
        {items.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={() => onToggle(item.id)}
              className="h-4 w-4 shrink-0 rounded border-edge-strong text-accent focus:ring-accent"
            />
            {item.color && (
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span className="truncate text-content-secondary">{item.name}</span>
          </label>
        ))}
        {items.length === 0 && (
          <p className="col-span-2 py-3 text-center text-xs text-content-muted">Nothing to pick.</p>
        )}
      </div>
    </fieldset>
  );
}

const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

interface JointClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (joint: JointClass) => void;
  subjects: Subject[];
  classes: ClassGroup[];
  teachers: Teacher[];
}

export const ClassGroupModal: React.FC<JointClassModalProps> = ({
  isOpen,
  onClose,
  onSave,
  subjects,
  classes,
  teachers,
}) => {
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);

  const isValid = Boolean(subjectId) && classIds.length >= 2;

  const reset = () => {
    setName("");
    setClassIds([]);
    setSubjectId("");
    setTeacherId("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      id: generateId(),
      name: name.trim() || "Class Group",
      subjectId,
      classIds,
      teacherId: teacherId || undefined,
    });
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New joint class"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            Create Group
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-content-muted">
          The selected classes will be scheduled for this subject in the same period.
        </p>

        <Field id="group-name" label="Group name">
          <input
            id="group-name"
            className={`${controlClass} w-full`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Senior Maths"
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="group-subject" label="Subject">
            <select
              id="group-subject"
              className={`${controlClass} w-full cursor-pointer`}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">Choose a subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="group-teacher" label="Teacher">
            <select
              id="group-teacher"
              className={`${controlClass} w-full cursor-pointer`}
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">Take from each curriculum</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Picker
          legend="Classes"
          requirement="Pick at least two."
          items={classes}
          selectedIds={classIds}
          onToggle={(id) => setClassIds((prev) => toggle(prev, id))}
        />
      </div>
    </Modal>
  );
};

interface ElectiveBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (elec: ElectiveBlock) => void;
  subjects: Subject[];
  classes: ClassGroup[];
}

export const ElectiveBlockModal: React.FC<ElectiveBlockModalProps> = ({
  isOpen,
  onClose,
  onSave,
  subjects,
  classes,
}) => {
  const [name, setName] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);

  const isValid = classIds.length > 0 && subjectIds.length >= 2;

  const reset = () => {
    setName("");
    setClassIds([]);
    setSubjectIds([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      id: generateId(),
      name: name.trim() || "Option Block",
      classIds,
      subjectIds,
    });
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New elective block"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            Create Block
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-content-muted">
          The selected subjects run at the same time, so students in these classes can take one
          each.
        </p>

        <Field id="block-name" label="Block name">
          <input
            id="block-name"
            className={`${controlClass} w-full`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Arts options"
            autoFocus
          />
        </Field>

        <Picker
          legend="Classes"
          requirement="Pick at least one."
          items={classes}
          selectedIds={classIds}
          onToggle={(id) => setClassIds((prev) => toggle(prev, id))}
        />

        <Picker
          legend="Subjects in the block"
          requirement="Pick at least two."
          items={subjects}
          selectedIds={subjectIds}
          onToggle={(id) => setSubjectIds((prev) => toggle(prev, id))}
        />
      </div>
    </Modal>
  );
};
