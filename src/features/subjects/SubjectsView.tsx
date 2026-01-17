import React, { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertTriangle,
  BookOpen,
  Users,
  Palette,
  Gem,
  Info,
  FileText,
} from "lucide-react";
import { AppData } from "../../types";
import { Subject } from "./types";
import { Button, Modal, Input } from "../../components/ui";
import { generateId } from "../../utils/utils";
import { COLOR_PALETTE } from "../../utils/constants";
import { useSubjectUsage } from "./hooks/useSubjectUsage";
import { useProfile } from "../../contexts/ProfileContext";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const SubjectsView: React.FC<ViewProps> = ({ data, onUpdate }) => {
  const { addActivity } = useProfile();
  const { getSubjectUsage } = useSubjectUsage(data);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjName, setSubjName] = useState("");

  // Default to first hex code in palette
  const [subjColor, setSubjColor] = useState(COLOR_PALETTE[0].hex);

  // Single Resource State
  const [isSingleResource, setIsSingleResource] = useState(false);
  const [isExaminable, setIsExaminable] = useState(true);
  const [requiredRoomType, setRequiredRoomType] = useState("");
  const [preferredRoomIds, setPreferredRoomIds] = useState<string[]>([]);

  // Room Types (Mirrored from RoomsView for simplicity)
  const ROOM_TYPES = [
    { value: "", label: "Any Room Type" },
    { value: "Classroom", label: "Standard Classroom" },
    { value: "Lab", label: "Laboratory" },
    { value: "Gym", label: "Gymnasium" },
    { value: "Art Studio", label: "Art Studio" },
    { value: "Music Room", label: "Music Room" },
    { value: "Hall", label: "Assembly Hall" },
    { value: "Computer Lab", label: "Computer Lab" },
    { value: "Workshop", label: "Workshop" },
  ];

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  // Smart Sort
  const sortedSubjects = useMemo(() => {
    return [...data.subjects].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.subjects]);

  const usedColors = useMemo(() => {
    return data.subjects
      .filter((s) => s.id !== editingSubject?.id)
      .map((s) => s.color);
  }, [data.subjects, editingSubject]);

  const availableRooms = useMemo(() => {
    if (!requiredRoomType) return data.rooms || [];
    return (data.rooms || []).filter(r => r.type === requiredRoomType);
  }, [data.rooms, requiredRoomType]);

  const saveSubject = () => {
    if (!subjName) return;
    const newSubj: Subject = {
      id: editingSubject ? editingSubject.id : generateId(),
      name: subjName,
      color: subjColor,
      isSingleResource: isSingleResource,
      isExaminable: isExaminable,
      requiredRoomType: requiredRoomType || undefined,
      preferredRoomIds: preferredRoomIds.length > 0 ? preferredRoomIds : undefined,
    };

    let newSubjects = [...data.subjects];
    if (editingSubject) {
      addActivity("ACADEMIC", `Updated Subject: ${newSubj.name}`);
      newSubjects = newSubjects.map((s) =>
        s.id === editingSubject.id ? newSubj : s
      );
    } else {
      addActivity("ACADEMIC", `Added Subject: ${newSubj.name}`);
      newSubjects.push(newSubj);
    }
    onUpdate({ ...data, subjects: newSubjects });
    setModalOpen(false);
  };

  const initiateDelete = (subj: Subject) => {
    setSubjectToDelete(subj);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!subjectToDelete) return;
    const id = subjectToDelete.id;

    try {
      addActivity("ACADEMIC", `Deleted Subject: ${subjectToDelete.name}`);
      const updatedSubjects = data.subjects.filter((s) => s.id !== id);
      const updatedTeachers = data.teachers.map((t) => ({
        ...t,
        specialtyIds: t.specialtyIds.filter((sid) => sid !== id),
      }));
      const updatedClasses = data.classes.map((c) => ({
        ...c,
        curriculum: c.curriculum.filter((curr) => curr.subjectId !== id),
      }));
      onUpdate({
        ...data,
        subjects: updatedSubjects,
        teachers: updatedTeachers,
        classes: updatedClasses,
      });
    } catch (e) {
      console.error(e);
    }

    setDeleteModalOpen(false);
    setSubjectToDelete(null);
  };

  const openModal = (subj?: Subject) => {
    setEditingSubject(subj || null);
    setSubjName(subj?.name || "");
    const defaultHex =
      COLOR_PALETTE.find((c) => !usedColors.includes(c.hex))?.hex ||
      COLOR_PALETTE[0].hex;
    setSubjColor(subj?.color || defaultHex);
    setIsSingleResource(subj?.isSingleResource || false);
    setIsExaminable(subj?.isExaminable !== undefined ? subj.isExaminable : true);
    setRequiredRoomType(subj?.requiredRoomType || "");
    setPreferredRoomIds(subj?.preferredRoomIds || []);
    setModalOpen(true);
  };

  const usageToDelete = subjectToDelete
    ? getSubjectUsage(subjectToDelete.id)
    : { classCount: 0, teacherCount: 0 };

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Subject Library</h2>
          <p className="text-xs text-slate-500">
            Manage academic disciplines and track their usage.
          </p>
        </div>
        <Button onClick={() => openModal()} icon={<Plus size={16} />}>
          New Subject
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {sortedSubjects.map((subj) => {
          const stats = getSubjectUsage(subj.id);
          return (
            <div
              key={subj.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col"
            >
              <div
                className="h-3 w-full relative"
                style={{ backgroundColor: subj.color }}
              >
                {subj.isSingleResource && (
                  <div
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 shadow-sm"
                    title="Single Resource"
                  >
                    <Gem size={10} className="text-purple-600" />
                  </div>
                )}
                {subj.isExaminable !== false && (
                  <div
                    className={`absolute top-1 ${subj.isSingleResource ? 'right-6' : 'right-1'} bg-white/90 rounded-full p-0.5 shadow-sm`}
                    title="Examinable"
                  >
                    <FileText size={10} className="text-amber-600" />
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col items-center text-center">
                <div
                  className="w-12 h-12 rounded-full mb-3 flex items-center justify-center text-lg font-bold shadow-sm relative"
                  style={{
                    backgroundColor: `${subj.color}15`,
                    color: subj.color,
                    border: `1px solid ${subj.color}30`,
                  }}
                >
                  {subj.name.substring(0, 2).toUpperCase()}
                  {subj.isSingleResource && (
                    <div className="absolute -bottom-1 -right-1 bg-purple-100 border border-purple-200 text-purple-700 text-[8px] font-bold px-1 rounded-full">
                      1x
                    </div>
                  )}
                </div>
                <h3
                  className="font-bold text-slate-800 mb-1 truncate w-full px-2"
                  title={subj.name}
                >
                  {subj.name}
                </h3>
                {subj.isSingleResource && (
                  <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full mb-2">
                    Single Resource
                  </span>
                )}

                <div className="flex flex-col gap-1 w-full mt-auto">
                  <div
                    className={`text-[10px] py-1 px-2 rounded flex items-center justify-center gap-1 ${
                      stats.classCount > 0
                        ? "bg-slate-100 text-slate-600"
                        : "bg-slate-50 text-slate-300"
                    }`}
                  >
                    <BookOpen size={10} />
                    {stats.classCount > 0
                      ? `${stats.classCount} Classes`
                      : "Unused"}
                  </div>
                  <div
                    className={`text-[10px] py-1 px-2 rounded flex items-center justify-center gap-1 ${
                      stats.teacherCount > 0
                        ? "bg-slate-100 text-slate-600"
                        : "bg-slate-50 text-slate-300"
                    }`}
                  >
                    <Users size={10} />
                    {stats.teacherCount > 0
                      ? `${stats.teacherCount} Teachers`
                      : "No Specialists"}
                  </div>
                </div>
              </div>

              <div className="flex border-t border-slate-100">
                <button
                  onClick={() => openModal(subj)}
                  className="flex-1 py-3 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center transition-colors"
                >
                  <Edit2 size={14} className="mr-1" /> Edit
                </button>
                <div className="w-px bg-slate-100"></div>
                <button
                  onClick={() => initiateDelete(subj)}
                  className="flex-1 py-3 text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center justify-center transition-colors"
                >
                  <Trash2 size={14} className="mr-1" /> Del
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => openModal()}
          className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50 transition-all flex flex-col items-center justify-center p-6 group h-full min-h-[200px]"
        >
          <div className="w-14 h-14 rounded-full bg-slate-200 group-hover:bg-amber-100 text-slate-400 group-hover:text-amber-500 flex items-center justify-center mb-3 transition-colors shadow-inner">
            <Plus size={28} />
          </div>
          <span className="font-bold text-slate-500 group-hover:text-amber-600">
            Add Subject
          </span>
        </button>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSubject ? "Edit Subject" : "New Subject"}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSubject}>Save Subject</Button>
          </div>
        }
        maxWidth="max-w-3xl"
      >
        <div className="space-y-6">
          <Input
            label="Subject Name"
            value={subjName}
            onChange={(e) => setSubjName(e.target.value)}
            autoFocus
            placeholder="e.g. Mathematics"
          />

          {/* Single Resource Toggle */}
          <div
            className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
              isSingleResource
                ? "bg-purple-50 border-purple-200"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
            onClick={() => setIsSingleResource(!isSingleResource)}
          >
            <div
              className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                isSingleResource
                  ? "bg-purple-600 border-purple-600"
                  : "bg-white border-slate-300"
              }`}
            >
              {isSingleResource && <Check size={14} className="text-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4
                  className={`text-sm font-bold ${
                    isSingleResource ? "text-purple-800" : "text-slate-700"
                  }`}
                >
                  Single Resource Facility
                </h4>
                <Gem
                  size={14}
                  className={
                    isSingleResource ? "text-purple-600" : "text-slate-400"
                  }
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Enable this for subjects that require a unique room (e.g. ICT
                Lab, Science Lab). The scheduler will ensure{" "}
                <strong>only one class</strong> in the entire school is
                scheduled for this subject at any given time.
              </p>
            </div>
          </div>

          {/* Examinable Toggle */}
          <div
            className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
              isExaminable
                ? "bg-amber-50 border-amber-200"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
            onClick={() => setIsExaminable(!isExaminable)}
          >
            <div
              className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                isExaminable
                  ? "bg-amber-600 border-amber-600"
                  : "bg-white border-slate-300"
              }`}
            >
              {isExaminable && <Check size={14} className="text-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4
                  className={`text-sm font-bold ${
                    isExaminable ? "text-amber-800" : "text-slate-700"
                  }`}
                >
                  Examinable Subject
                </h4>
                <FileText
                  size={14}
                  className={
                    isExaminable ? "text-amber-600" : "text-slate-400"
                  }
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                If enabled, this subject will be automatically selected for inclusion when auto-generating the exam timetable.
              </p>
            </div>
          </div>

          {/* Room Requirements */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Users size={16} /> Room Allocation Rules
            </h4>
            
            <div className="space-y-2">
               <label className="block text-xs font-bold text-slate-500 uppercase">Required Room Type</label>
               <select
                 className="w-full rounded-md border-slate-300 text-sm p-2 focus:ring-amber-500 focus:border-amber-500"
                 value={requiredRoomType}
                 onChange={(e) => {
                    setRequiredRoomType(e.target.value);
                    setPreferredRoomIds([]); // Reset preferred on type change
                 }}
               >
                 {ROOM_TYPES.map(opt => (
                   <option key={opt.value} value={opt.value}>{opt.label}</option>
                 ))}
               </select>
            </div>

            <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase">
                    Preferred Rooms {requiredRoomType && `(${requiredRoomType})`}
                </label>
                <div className="flex flex-wrap gap-2">
                    {availableRooms.map(room => (
                        <button
                          key={room.id}
                          onClick={() => setPreferredRoomIds(prev => 
                             prev.includes(room.id) 
                             ? prev.filter(id => id !== room.id)
                             : [...prev, room.id]
                          )}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${
                             preferredRoomIds.includes(room.id)
                             ? "bg-slate-700 text-white border-slate-700 shadow-sm"
                             : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                           {room.name}
                        </button>
                    ))}
                    {availableRooms.length === 0 && (
                        <span className="text-xs text-slate-400 italic">No rooms available matching this type.</span>
                    )}
                </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                Select Identifier Color
              </label>
              <div className="flex items-center text-[10px] text-slate-400 gap-1 bg-slate-100 px-2 py-1 rounded">
                <Palette size={10} /> {COLOR_PALETTE.length} Distinct Shades
              </div>
            </div>

            <div className="grid grid-cols-8 gap-3 p-1">
              {COLOR_PALETTE.map((colorObj) => {
                const isUsed = usedColors.includes(colorObj.hex);
                const isSelected = subjColor === colorObj.hex;

                return (
                  <button
                    key={colorObj.hex}
                    disabled={isUsed && !isSelected}
                    onClick={() => setSubjColor(colorObj.hex)}
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
                    title={
                      isUsed && !isSelected
                        ? `${colorObj.name} (Used)`
                        : colorObj.name
                    }
                  >
                    {isSelected && (
                      <Check size={12} className="text-white drop-shadow-md" />
                    )}
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

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Subject?"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
            >
              Keep It
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Yes, Delete Everything
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-lg">
              Are you sure you want to delete "{subjectToDelete?.name}"?
            </p>

            {usageToDelete.classCount > 0 || usageToDelete.teacherCount > 0 ? (
              <div className="mt-3 bg-red-50 border border-red-100 p-3 rounded-lg text-sm text-red-700">
                <p className="font-bold mb-1">Warning: Active Dependencies</p>
                <ul className="list-disc list-inside space-y-1">
                  {usageToDelete.teacherCount > 0 && (
                    <li>
                      Removed from <b>{usageToDelete.teacherCount}</b> teacher
                      profiles.
                    </li>
                  )}
                  {usageToDelete.classCount > 0 && (
                    <li>
                      Removed from <b>{usageToDelete.classCount}</b> class
                      curriculums.
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-xs opacity-80">
                  This action cannot be undone.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2">
                This subject is not currently in use. It is safe to delete.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
