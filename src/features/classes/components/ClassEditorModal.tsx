import React from "react";
import { AppData } from "../../../types";
import { ClassGroup } from "../types";
import { Button, Modal, controlClass, quietButtonClass } from "../../../components/ui";
import { DAYS } from "../../../utils/constants";
import { useClassForm } from "../hooks/useClassForm";
import { ClassBasicsSection } from "./ClassBasicsSection";
import { ClassStructureSection } from "./ClassStructureSection";
import { ClassCurriculumSection } from "./ClassCurriculumSection";

interface ClassEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingClass: ClassGroup | null;
  data: AppData;
  onSave: (cls: ClassGroup, original: ClassGroup | null) => void;
}

export const ClassEditorModal: React.FC<ClassEditorModalProps> = (props) => {
  const { isOpen, onClose, editingClass } = props;
  const form = useClassForm(props);

  const {
    modalSubTab,
    setModalSubTab,
    handleSave,
    activeSlot,
    setActiveSlot,
    slotLabel,
    setSlotLabel,
    saveSlotLabel,
  } = form;

  const subTabs = [
    { id: "BASICS", label: "Basics" },
    { id: "STRUCTURE", label: "Structure" },
  ] as const;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingClass ? `Edit ${editingClass.name}` : "New Class Group"}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!form.cName.trim()}>
            Save Class
          </Button>
        </div>
      }
    >
      <div className="flex h-[65vh] min-h-0 flex-col gap-5 lg:flex-row">
        <div className="custom-scrollbar flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-edge pr-1 lg:w-72 lg:border-r lg:pr-5">
          <div
            role="tablist"
            aria-label="Class settings"
            className="sticky top-0 z-10 inline-flex h-9 items-center rounded-md border border-edge bg-surface p-0.5"
          >
            {subTabs.map((tab) => {
              const isActive = modalSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setModalSubTab(tab.id)}
                  className={`h-8 flex-1 rounded px-3 text-sm transition-colors focus-visible:outline-none
                              focus-visible:ring-2 focus-visible:ring-accent ${
                                isActive
                                  ? "bg-surface-inset font-medium text-content dark:bg-slate-700"
                                  : "text-content-muted hover:text-content"
                              }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {modalSubTab === "BASICS" ? (
            <ClassBasicsSection
              data={props.data}
              editingClass={editingClass}
              cName={form.cName}
              setCName={form.setCName}
              cPeriodCount={form.cPeriodCount}
              cFixedSessions={form.cFixedSessions}
              activeSlot={activeSlot}
              setSlotLabel={form.setSlotLabel}
              setActiveSlot={form.setActiveSlot}
            />
          ) : (
            <ClassStructureSection
              data={props.data}
              cPeriodCount={form.cPeriodCount}
              handlePeriodCountChange={form.handlePeriodCountChange}
              cDuration={form.cDuration}
              setCDuration={form.setCDuration}
              cBreakDuration={form.cBreakDuration}
              setCBreakDuration={form.setCBreakDuration}
              cLunchDuration={form.cLunchDuration}
              setCLunchDuration={form.setCLunchDuration}
              cStructure={form.cStructure}
              setCStructure={form.setCStructure}
            />
          )}

          {/* Reserving a slot used to open a second overlay on top of this modal,
              with no escape handling and no focus management. It edits in place
              beneath the grid instead. */}
          {activeSlot && modalSubTab === "BASICS" && (
            <div className="rounded-md border border-edge border-l-2 border-l-accent bg-surface p-3">
              <label
                htmlFor="class-slot-label"
                className="mb-1.5 block text-xs font-medium text-content"
              >
                Reserve {DAYS[activeSlot.d]} period {activeSlot.p + 1}
              </label>
              <input
                id="class-slot-label"
                autoFocus
                className={`${controlClass} w-full`}
                placeholder="Worship"
                value={slotLabel}
                onChange={(e) => setSlotLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveSlotLabel();
                  if (e.key === "Escape") setActiveSlot(null);
                }}
              />
              <div className="mt-2 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSlot(null)}
                  className={`${quietButtonClass} h-7 px-2 text-xs`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSlotLabel("");
                    saveSlotLabel();
                  }}
                  className={`${quietButtonClass} h-7 px-2 text-xs`}
                >
                  Clear
                </button>
                <Button size="sm" onClick={saveSlotLabel} disabled={!slotLabel.trim()}>
                  Reserve
                </Button>
              </div>
            </div>
          )}
        </div>

        <ClassCurriculumSection
          data={props.data}
          cCurriculum={form.cCurriculum}
          setCCurriculum={form.setCCurriculum}
        />
      </div>
    </Modal>
  );
};
