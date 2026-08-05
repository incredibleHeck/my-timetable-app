import React from "react";
import { Button, Modal } from "../../../components/ui";
import { Subject } from "../types";
import { Teacher } from "../../teachers/types";

interface SubjectTeacherListModalProps {
  subject: Subject;
  teachers: Teacher[];
  onClose: () => void;
}

/**
 * Uses the shared Modal rather than a hand-rolled overlay: the previous version
 * had no dialog role and no Escape handling, so it could only be dismissed by
 * finding its close button.
 */
export const SubjectTeacherListModal: React.FC<SubjectTeacherListModalProps> = ({
  subject,
  teachers,
  onClose,
}) => {
  const specialists = teachers
    .filter((t) => t.specialtyIds.includes(subject.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${subject.name} specialists`}
      maxWidth="max-w-md"
      footer={
        <div className="flex w-full justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-content-muted">
        Teachers who list {subject.name} among their subjects and can therefore be assigned to it.
      </p>
      {specialists.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge px-4 py-6 text-center text-xs text-content-muted">
          No teacher lists this subject yet.
        </p>
      ) : (
        <ul className="custom-scrollbar max-h-[50vh] divide-y divide-edge-subtle overflow-y-auto rounded-md border border-edge">
          {specialists.map((teacher) => (
            <li key={teacher.id} className="px-3 py-2">
              <span className="text-sm text-content">{teacher.name}</span>
              {teacher.email && (
                <span className="ml-2 text-xs text-content-muted">{teacher.email}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};
