import React, { useState } from "react";
import { Subject } from "../../../types";
import { JointClass, ElectiveBlock, ClassGroup } from "../types";
import { Button, Modal, Input, Select } from "../../../components/ui";
import { generateId } from "../../../utils/utils";

interface JointClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (joint: JointClass) => void;
  subjects: Subject[];
  classes: ClassGroup[];
}

export const JointClassModal: React.FC<JointClassModalProps> = ({
  isOpen,
  onClose,
  onSave,
  subjects,
  classes,
}) => {
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);

  const handleSave = () => {
    if (!subjectId || classIds.length < 2) return;
    onSave({
      id: generateId(),
      name: name || "Joint Group",
      subjectId,
      classIds,
    });
    onClose();
    setName("");
    setClassIds([]);
    setSubjectId("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Linked Class">
      <div className="space-y-4">
        <Input
          label="Link Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Senior Math"
        />
        <Select
          label="Subject"
          options={[
            { value: "", label: "Select" },
            ...subjects.map((s) => ({ value: s.id, label: s.name })),
          ]}
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        />
        <div className="border p-2 rounded max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
          {classes.map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={classIds.includes(c.id)}
                onChange={() => {
                  if (classIds.includes(c.id))
                    setClassIds(classIds.filter((x) => x !== c.id));
                  else setClassIds([...classIds, c.id]);
                }}
              />
              <span className="text-sm">{c.name}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave}>Create Link</Button>
        </div>
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

  const handleSave = () => {
    if (classIds.length === 0 || subjectIds.length < 2) return;
    onSave({
      id: generateId(),
      name: name || "Option Block",
      classIds,
      subjectIds,
    });
    onClose();
    setName("");
    setClassIds([]);
    setSubjectIds([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Elective Block">
      <div className="space-y-4">
        <Input
          label="Block Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Arts Options"
        />
        
        <label className="block text-xs font-bold text-slate-500">
          Select Classes
        </label>
        <div className="border p-2 rounded max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
          {classes.map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={classIds.includes(c.id)}
                onChange={() => {
                  if (classIds.includes(c.id))
                    setClassIds(classIds.filter((x) => x !== c.id));
                  else setClassIds([...classIds, c.id]);
                }}
              />
              <span className="text-sm">{c.name}</span>
            </label>
          ))}
        </div>

        <label className="block text-xs font-bold text-slate-500">
          Select Subjects in Block
        </label>
        <div className="border p-2 rounded max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
          {subjects.map((s) => (
            <label key={s.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={subjectIds.includes(s.id)}
                onChange={() => {
                  if (subjectIds.includes(s.id))
                    setSubjectIds(subjectIds.filter((x) => x !== s.id));
                  else setSubjectIds([...subjectIds, s.id]);
                }}
              />
              <span className="text-sm">{s.name}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave}>Create Block</Button>
        </div>
      </div>
    </Modal>
  );
};
