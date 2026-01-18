import React from "react";
import { Link2, X, Layers } from "lucide-react";
import { AppData } from "../../../types";
import { Button } from "../../../components/ui";

interface ClassGroupsProps {
  data: AppData;
  onAddLink: () => void;
  onAddElective: () => void;
  onRemoveJoint: (id: string) => void;
  onRemoveElective: (id: string) => void;
}

export const ClassGroups: React.FC<ClassGroupsProps> = ({
  data,
  onAddLink,
  onAddElective,
  onRemoveJoint,
  onRemoveElective,
}) => {
  return (
    <div className="space-y-12">
      {/* LINKED CLASSES */}
      <div className="space-y-4 animate-in slide-in-from-right-4">
        <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="text-sm text-blue-800">
            <span className="font-bold">Horizontal Linking:</span> Schedule{" "}
            <b>Multiple Classes</b> to have the <b>Same Subject</b> at the{" "}
            <b>Same Time</b>.
          </div>
          <Button onClick={onAddLink} size="sm">
            New Link
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.jointClasses.map((joint) => (
            <div
              key={joint.id}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group"
            >
              <button
                onClick={() => onRemoveJoint(joint.id)}
                className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
              <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Link2 size={16} className="text-blue-500" /> {joint.name}
              </h4>
              <div className="text-xs font-bold text-slate-600 mb-2 px-2 py-1 bg-slate-100 rounded inline-block">
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
            <span className="font-bold">Vertical Blocking:</span> Schedule{" "}
            <b>Multiple Subjects</b> for <b>One Class</b> at the{" "}
            <b>Same Time</b> (Options/Electives).
          </div>
          <Button onClick={onAddElective} size="sm">
            New Block
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(data.electives || []).map((elec) => (
            <div
              key={elec.id}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group"
            >
              <button
                onClick={() => onRemoveElective(elec.id)}
                className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
              <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Layers size={16} className="text-purple-500" /> {elec.name}
              </h4>
              <div className="text-xs font-bold text-slate-500 mb-3">
                Classes:{" "}
                <span className="text-slate-800">
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
                    <div
                      key={sid}
                      className="flex items-center gap-2 text-xs"
                    >
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
    </div>
  );
};
