import React from "react";
import { Check, BookOpen, Users, Palette, Gem, FileText } from "lucide-react";
import { AppData } from "../../../types";
import { Button, Modal, Input } from "../../../components/ui";
import { COLOR_PALETTE } from "../../../utils/constants";
import { SubjectFormState } from "../hooks/useSubjectForm";

interface SubjectEditorModalProps {
  form: SubjectFormState;
  data: AppData;
}

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

  return (
    <Modal
      isOpen={modalOpen}
      onClose={closeModal}
      title={editingSubject ? "Edit Subject" : "New Subject"}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button onClick={save}>Save Subject</Button>
        </div>
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        <Input
          label="Subject Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="e.g. Mathematics"
        />

        {/* Single Resource Toggle */}
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
            isSingleResource
              ? "bg-purple-50 border-purple-200"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300"
          }`}
          onClick={() => setIsSingleResource(!isSingleResource)}
        >
          <div
            className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
              isSingleResource
                ? "bg-purple-600 border-purple-600"
                : "bg-white dark:bg-slate-800 border-slate-300"
            }`}
          >
            {isSingleResource && <Check size={14} className="text-white" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4
                className={`text-sm font-bold ${
                  isSingleResource ? "text-purple-800" : "text-slate-700 dark:text-slate-200"
                }`}
              >
                Single Resource Facility
              </h4>
              <Gem size={14} className={isSingleResource ? "text-purple-600" : "text-slate-400"} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enable this for subjects that require a unique room (e.g. ICT Lab, Science Lab). The
              scheduler will ensure <strong>only one class</strong> in the entire school is
              scheduled for this subject at any given time.
            </p>
          </div>
        </div>

        {/* Examinable Toggle */}
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
            isExaminable
              ? "bg-amber-50 border-amber-200"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300"
          }`}
          onClick={() => setIsExaminable(!isExaminable)}
        >
          <div
            className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
              isExaminable
                ? "bg-amber-600 border-amber-600"
                : "bg-white dark:bg-slate-800 border-slate-300"
            }`}
          >
            {isExaminable && <Check size={14} className="text-white" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4
                className={`text-sm font-bold ${
                  isExaminable ? "text-amber-800" : "text-slate-700 dark:text-slate-200"
                }`}
              >
                Examinable Subject
              </h4>
              <FileText size={14} className={isExaminable ? "text-amber-600" : "text-slate-400"} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              If enabled, this subject will be automatically selected for inclusion when
              auto-generating the exam timetable.
            </p>
          </div>
        </div>

        {/* Core Subject Toggle */}
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
            isCore
              ? "bg-blue-50 border-blue-200"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300"
          }`}
          onClick={() => setIsCore(!isCore)}
        >
          <div
            className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
              isCore ? "bg-blue-600 border-blue-600" : "bg-white dark:bg-slate-800 border-slate-300"
            }`}
          >
            {isCore && <Check size={14} className="text-white" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4
                className={`text-sm font-bold ${isCore ? "text-blue-800" : "text-slate-700 dark:text-slate-200"}`}
              >
                Core Subject
              </h4>
              <BookOpen size={14} className={isCore ? "text-blue-600" : "text-slate-400"} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Marks this as a core discipline for morning bias, weekly balance, and spread
              heuristics. When unset, the scheduler falls back to English name matching.
            </p>
          </div>
        </div>

        {/* Room Requirements */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 space-y-4">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Users size={16} /> Facility Mapping
          </h4>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
              Fixed Facility / Room
            </label>
            <select
              className="w-full rounded-md border-slate-300 text-sm p-2 focus:ring-amber-500 focus:border-amber-500"
              value={requiredRoomId || ""}
              onChange={(e) => setRequiredRoomId(e.target.value || null)}
            >
              <option value="">No Fixed Room (Use Home Classroom)</option>
              {(data.rooms || []).map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} ({room.type})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 italic">
              If selected, this subject will always be scheduled in this specific room.
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Select Identifier Color
            </label>
            <div className="flex items-center text-[10px] text-slate-400 gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
              <Palette size={10} /> {COLOR_PALETTE.length} Distinct Shades
            </div>
          </div>

          <div className="grid grid-cols-8 gap-3 p-1">
            {COLOR_PALETTE.map((colorObj) => {
              const usedColors = data.subjects
                .filter((s) => s.id !== editingSubject?.id)
                .map((s) => s.color);
              const isUsed = usedColors.includes(colorObj.hex);
              const isSelected = color === colorObj.hex;

              return (
                <button
                  key={colorObj.hex}
                  disabled={isUsed && !isSelected}
                  onClick={() => setColor(colorObj.hex)}
                  className={`
                      w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 relative group/btn hover:z-50
                      ${
                        isUsed && !isSelected
                          ? "opacity-20 grayscale cursor-not-allowed scale-90"
                          : "hover:scale-125 shadow-sm cursor-pointer"
                      }
                      ${
                        isSelected
                          ? "ring-2 ring-offset-2 ring-slate-800 scale-125 z-10 shadow-md"
                          : ""
                      }
                    `}
                  style={{ backgroundColor: colorObj.hex }}
                  title={isUsed && !isSelected ? `${colorObj.name} (Used)` : colorObj.name}
                >
                  {isSelected && <Check size={12} className="text-white drop-shadow-md" />}
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover/btn:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity shadow-lg">
                    {colorObj.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};
