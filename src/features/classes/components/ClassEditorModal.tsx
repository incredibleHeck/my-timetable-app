import React from "react";
import { AppData } from "../../../types";
import { ClassGroup } from "../types";
import { Button, Modal, Input } from "../../../components/ui";
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
    slotLabel,
    setSlotLabel,
    saveSlotLabel,
  } = form;

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
                  modalSubTab === "BASICS" ? "bg-white shadow text-slate-800" : "text-slate-500"
                }`}
              >
                Basics
              </button>
              <button
                onClick={() => setModalSubTab("STRUCTURE")}
                className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${
                  modalSubTab === "STRUCTURE" ? "bg-white shadow text-slate-800" : "text-slate-500"
                }`}
              >
                Structure
              </button>
            </div>

            {modalSubTab === "BASICS" ? (
              <ClassBasicsSection
                data={props.data}
                editingClass={editingClass}
                cName={form.cName}
                setCName={form.setCName}
                cPeriodCount={form.cPeriodCount}
                cFixedSessions={form.cFixedSessions}
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
          </div>

          <ClassCurriculumSection
            data={props.data}
            cCurriculum={form.cCurriculum}
            setCCurriculum={form.setCCurriculum}
          />
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
