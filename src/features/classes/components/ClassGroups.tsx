import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { AppData } from "../../../types";
import { ConfirmDialog, Panel, PanelRegion, quietButtonClass } from "../../../components/ui";
import { ClassGroupModal, ElectiveBlockModal } from "./GroupModals";
import { useClassActions } from "../hooks/useClassActions";

interface ClassGroupsProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

type PendingRemoval = { kind: "group" | "block"; id: string; name: string };

const rowDeleteClass =
  "grid h-7 w-7 shrink-0 place-items-center rounded text-content-muted transition-colors " +
  "hover:bg-surface-inset hover:text-danger-ink focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface";

const emptyState = (text: string) => (
  <p className="px-5 py-8 text-center text-xs text-content-muted">{text}</p>
);

export const ClassGroups: React.FC<ClassGroupsProps> = ({ data, onUpdate }) => {
  const { handleSaveGroup, handleRemoveGroup, handleSaveBlock, handleRemoveBlock } =
    useClassActions(data, onUpdate);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [pending, setPending] = useState<PendingRemoval | null>(null);

  const subjectName = (id: string) => data.subjects.find((s) => s.id === id)?.name;
  const subjectColor = (id: string) => data.subjects.find((s) => s.id === id)?.color;
  const className = (id: string) => data.classes.find((c) => c.id === id)?.name;

  const confirmRemoval = () => {
    if (!pending) return;
    if (pending.kind === "group") handleRemoveGroup(pending.id);
    else handleRemoveBlock(pending.id);
    setPending(null);
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Joint classes"
        description="Several classes take the same subject in the same period — a shared PE session, or two streams merged for a language."
        action={
          <button
            type="button"
            onClick={() => setIsGroupModalOpen(true)}
            className={quietButtonClass}
          >
            New group
          </button>
        }
      >
        <PanelRegion className="divide-y divide-edge-subtle">
          {data.jointClasses.length === 0
            ? emptyState("No joint classes yet.")
            : data.jointClasses.map((joint) => (
                <div key={joint.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-40 shrink-0 truncate text-sm font-medium text-content">
                    {joint.name}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-edge bg-surface-muted px-2 py-0.5 text-2xs text-content-secondary">
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: subjectColor(joint.subjectId) }}
                    />
                    {subjectName(joint.subjectId) ?? "Unknown subject"}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {joint.classIds.map((cid) => (
                      <span
                        key={cid}
                        className="rounded border border-edge px-1.5 py-0.5 text-2xs text-content-secondary"
                      >
                        {className(cid) ?? "Removed class"}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPending({ kind: "group", id: joint.id, name: joint.name })}
                    title={`Delete ${joint.name}`}
                    aria-label={`Delete ${joint.name}`}
                    className={rowDeleteClass}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              ))}
        </PanelRegion>
      </Panel>

      <Panel
        title="Elective blocks"
        description="One class splits across several subjects in the same period, so students can take different options side by side."
        action={
          <button
            type="button"
            onClick={() => setIsBlockModalOpen(true)}
            className={quietButtonClass}
          >
            New block
          </button>
        }
      >
        <PanelRegion className="divide-y divide-edge-subtle">
          {(data.electives || []).length === 0
            ? emptyState("No elective blocks yet.")
            : (data.electives || []).map((elec) => (
                <div key={elec.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-40 shrink-0">
                    <div className="truncate text-sm font-medium text-content">{elec.name}</div>
                    <div className="truncate text-2xs text-content-muted">
                      {elec.classIds.map(className).filter(Boolean).join(", ") || "No classes"}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {elec.subjectIds.map((sid) => (
                      <span
                        key={sid}
                        className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface-muted px-2 py-0.5 text-2xs text-content-secondary"
                      >
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: subjectColor(sid) }}
                        />
                        {subjectName(sid) ?? "Unknown subject"}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPending({ kind: "block", id: elec.id, name: elec.name })}
                    title={`Delete ${elec.name}`}
                    aria-label={`Delete ${elec.name}`}
                    className={rowDeleteClass}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              ))}
        </PanelRegion>
      </Panel>

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

      {/* Removal used to happen on a single click of a hover-only X. */}
      <ConfirmDialog
        isOpen={pending !== null}
        title={pending?.kind === "block" ? "Delete elective block?" : "Delete joint class?"}
        message={
          pending
            ? `${pending.name} will no longer be scheduled together. The classes and subjects themselves are unaffected.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmRemoval}
        onCancel={() => setPending(null)}
      />
    </div>
  );
};
