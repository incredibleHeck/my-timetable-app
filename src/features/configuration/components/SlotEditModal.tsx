import React from "react";
import { Modal, Button } from "../../../components/ui";
import { DAYS } from "../../../utils/constants";
import { controlClass } from "./ConfigPanel";

const OCCASION_PRESETS = ["Assembly", "Staff Meeting", "CCA", "Chapel"] as const;

interface SlotEditModalProps {
  editingSlot: { d: number; p: number; label: string } | null;
  setEditingSlot: (slot: { d: number; p: number; label: string } | null) => void;
  applyToAllDays: boolean;
  setApplyToAllDays: (apply: boolean) => void;
  saveSlot: (label: string) => void;
}

export const SlotEditModal: React.FC<SlotEditModalProps> = ({
  editingSlot,
  setEditingSlot,
  applyToAllDays,
  setApplyToAllDays,
  saveSlot,
}) => {
  const setLabel = (label: string) => {
    if (editingSlot) setEditingSlot({ ...editingSlot, label });
  };

  const slotName = editingSlot
    ? `${DAYS[editingSlot.d] ?? "Day"}, period ${editingSlot.p + 1}`
    : "";
  const isExisting = Boolean(editingSlot?.label);

  return (
    <Modal
      isOpen={!!editingSlot}
      onClose={() => setEditingSlot(null)}
      title="Reserve slot"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {isExisting ? (
            <Button variant="ghost" onClick={() => saveSlot("")}>
              Remove reservation
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditingSlot(null)}>
              Cancel
            </Button>
            <Button onClick={() => saveSlot(editingSlot?.label?.trim() || "Reserved")}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-xs text-content-muted">
          Blocks <span className="font-medium text-content-secondary">{slotName}</span> for every
          class. The generator will not place lessons here.
        </p>

        <div>
          <label
            htmlFor="reservation-name"
            className="mb-1.5 block text-sm font-medium text-content"
          >
            Name
          </label>
          <input
            id="reservation-name"
            className={`${controlClass} w-full`}
            value={editingSlot?.label || ""}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Morning Assembly"
            autoFocus
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {OCCASION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLabel(preset)}
                className="rounded-full border border-edge px-2.5 py-1 text-xs text-content-secondary
                           transition-colors hover:border-accent hover:text-accent-ink
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                           focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={applyToAllDays}
            onChange={(e) => setApplyToAllDays(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-edge-strong text-accent focus:ring-accent"
          />
          <span>
            <span className="block text-sm text-content">Repeat on every day</span>
            <span className="block text-xs text-content-muted">
              Reserves period {(editingSlot?.p ?? 0) + 1} Monday through Friday.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
};
