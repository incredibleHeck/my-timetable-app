import React from "react";
import { Check } from "lucide-react";
import { AppData } from "../../../types";
import { Button, Modal, controlClass } from "../../../components/ui";
import { COLOR_PALETTE } from "../../../utils/constants";
import { SubjectFormState } from "../hooks/useSubjectForm";

interface SubjectEditorModalProps {
  form: SubjectFormState;
  data: AppData;
}

interface ToggleRowProps {
  id: string;
  label: string;
  description: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * A real checkbox with a label. The three settings here used to be `div`s with
 * an onClick and a hand-drawn tick in purple, amber and blue — three colours for
 * three equivalent switches, none of which could be reached from the keyboard.
 */
const ToggleRow: React.FC<ToggleRowProps> = ({ id, label, description, checked, onChange }) => (
  <div className="flex items-start gap-3 px-4 py-3">
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-4 w-4 shrink-0 rounded border-edge-strong text-accent focus:ring-accent"
    />
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-medium text-content">
        {label}
      </label>
      <p className="mt-0.5 text-xs leading-relaxed text-content-muted">{description}</p>
    </div>
  </div>
);

export const SubjectEditorModal: React.FC<SubjectEditorModalProps> = ({ form, data }) => {
  const {
    modalOpen,
    editingSubject,
    name,
    setName,
    color,
    setColor,
    isSingleResource,
    setIsSingleResource,
    isExaminable,
    setIsExaminable,
    isCore,
    setIsCore,
    requiredRoomId,
    setRequiredRoomId,
    closeModal,
    save,
  } = form;

  // Hex values are compared lower-cased: subjects stored with mixed-case colours
  // ("#A0522D") otherwise read as unused, and the picker would hand the same
  // shade to a second subject.
  const usedColors = new Set(
    data.subjects.filter((s) => s.id !== editingSubject?.id).map((s) => s.color?.toLowerCase()),
  );
  const selectedColorName = COLOR_PALETTE.find(
    (c) => c.hex.toLowerCase() === color?.toLowerCase(),
  )?.name;

  return (
    <Modal
      isOpen={modalOpen}
      onClose={closeModal}
      title={editingSubject ? "Edit Subject" : "New Subject"}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim()}>
            Save Subject
          </Button>
        </div>
      }
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="subject-name" className="mb-1.5 block text-sm font-medium text-content">
              Name
            </label>
            <input
              id="subject-name"
              className={`${controlClass} w-full`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Mathematics"
            />
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <span
              className="h-8 w-8 rounded-md ring-1 ring-black/10"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <span className="text-xs text-content-muted">{selectedColorName ?? "Custom"}</span>
          </div>
        </div>

        <div>
          <h4 className="mb-1.5 text-sm font-medium text-content">Colour</h4>
          <p className="mb-2 text-xs text-content-muted">
            Identifies this subject across timetables and exports. Colours already taken by another
            subject are disabled.
          </p>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((colorObj) => {
              const isSelected = color?.toLowerCase() === colorObj.hex.toLowerCase();
              const isUsed = usedColors.has(colorObj.hex.toLowerCase());
              return (
                <button
                  key={colorObj.hex}
                  type="button"
                  disabled={isUsed && !isSelected}
                  onClick={() => setColor(colorObj.hex)}
                  aria-pressed={isSelected}
                  aria-label={isUsed && !isSelected ? `${colorObj.name} (in use)` : colorObj.name}
                  title={isUsed && !isSelected ? `${colorObj.name} — in use` : colorObj.name}
                  style={{ backgroundColor: colorObj.hex }}
                  className={`grid h-7 w-7 place-items-center rounded-md ring-1 ring-inset ring-black/10
                              transition-shadow focus-visible:outline-none focus-visible:ring-2
                              focus-visible:ring-accent focus-visible:ring-offset-2
                              focus-visible:ring-offset-surface
                              disabled:cursor-not-allowed disabled:opacity-25 ${
                                isSelected
                                  ? "ring-2 ring-offset-2 ring-offset-surface ring-content"
                                  : ""
                              }`}
                >
                  {isSelected && <Check size={13} className="text-white drop-shadow" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="divide-y divide-edge-subtle rounded-lg border border-edge">
          <ToggleRow
            id="subject-core"
            label="Core subject"
            checked={isCore}
            onChange={setIsCore}
            description="Scheduled earlier in the day where possible, with weekly balance and spread heuristics applied. Only subjects ticked here get that priority."
          />
          <ToggleRow
            id="subject-single-resource"
            label="Single resource"
            checked={isSingleResource}
            onChange={setIsSingleResource}
            description="For subjects tied to one facility, such as an ICT or science lab. Only one class in the school can be scheduled for it at a time."
          />
          <ToggleRow
            id="subject-examinable"
            label="Examinable"
            checked={isExaminable}
            onChange={setIsExaminable}
            description="Included automatically when auto-generating the exam timetable."
          />
        </div>

        <div>
          <label htmlFor="subject-room" className="mb-1.5 block text-sm font-medium text-content">
            Room requirement
          </label>
          <select
            id="subject-room"
            className={`${controlClass} w-full cursor-pointer`}
            value={requiredRoomId || ""}
            onChange={(e) => setRequiredRoomId(e.target.value || null)}
          >
            <option value="">No fixed room — use the class home room</option>
            {(data.rooms || []).map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.type})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-content-muted">
            When set, every lesson of this subject is scheduled in that room.
          </p>
        </div>
      </div>
    </Modal>
  );
};
