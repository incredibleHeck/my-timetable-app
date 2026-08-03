import React, { useState } from "react";
import { Link2, X, Layers } from "lucide-react";
import { AppData } from "../../../types";
import { Button } from "../../../components/ui";
import { ClassGroupModal, ElectiveBlockModal } from "./GroupModals";
import { useClassActions } from "../hooks/useClassActions";

interface ClassGroupsProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const ClassGroups: React.FC<ClassGroupsProps> = ({ data, onUpdate }) => {
  const { handleSaveGroup, handleRemoveGroup, handleSaveBlock, handleRemoveBlock } =
    useClassActions(data, onUpdate);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);

  return (
    <div className="space-y-12">
      {/* CLASS GROUPS */}
      <div className="space-y-4 animate-in slide-in-from-right-4">
        <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="text-sm text-blue-800">
            <span className="font-bold">Horizontal Linking:</span> Schedule <b>Multiple Classes</b>{" "}
            to have the <b>Same Subject</b> at the <b>Same Time</b>.
          </div>
          <Button onClick={() => setIsGroupModalOpen(true)} size="sm">
            New Group
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.jointClasses.map((joint) => (
            <div
              key={joint.id}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm relative group"
            >
              <button
                onClick={() => handleRemoveGroup(joint.id)}
                className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                <Link2 size={16} className="text-blue-500" /> {joint.name}
              </h4>
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded inline-block">
                {data.subjects.find((s) => s.id === joint.subjectId)?.name}
              </div>
              <div className="flex flex-wrap gap-1">
                {joint.classIds.map((cid) => (
                  <span key={cid} className="text-[10px] border px-1 rounded">
                    {data.classes.find((c) => c.id === cid)?.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ELECTIVE BLOCKS */}
      <div className="space-y-4 animate-in slide-in-from-right-4">
        <div className="flex justify-between items-center bg-purple-50 p-4 rounded-xl border border-purple-100">
          <div className="text-sm text-purple-800">
            <span className="font-bold">Vertical Blocking:</span> Schedule <b>Multiple Subjects</b>{" "}
            for <b>One Class</b> at the <b>Same Time</b> (Options/Electives).
          </div>
          <Button onClick={() => setIsBlockModalOpen(true)} size="sm">
            New Block
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(data.electives || []).map((elec) => (
            <div
              key={elec.id}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm relative group"
            >
              <button
                onClick={() => handleRemoveBlock(elec.id)}
                className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                <Layers size={16} className="text-purple-500" /> {elec.name}
              </h4>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">
                Classes:{" "}
                <span className="text-slate-800 dark:text-slate-100">
                  {elec.classIds
                    .map((cid) => data.classes.find((c) => c.id === cid)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
              <div className="space-y-1">
                {elec.subjectIds.map((sid) => {
                  const subj = data.subjects.find((s) => s.id === sid);
                  return (
                    <div key={sid} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: subj?.color }}
                      ></div>
                      <span>{subj?.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals handled locally */}
      <ClassGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        subjects={data.subjects}
        classes={data.classes}
        teachers={data.teachers}
        onSave={handleSaveGroup}
      />

      <ElectiveBlockModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        subjects={data.subjects}
        classes={data.classes}
        onSave={handleSaveBlock}
      />
    </div>
  );
};
