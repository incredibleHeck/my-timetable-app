import React from "react";
import { Modal, Button, Input } from "../../../components/ui";

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

  return (
    <Modal
      isOpen={!!editingSlot}
      onClose={() => setEditingSlot(null)}
      title="Configure Global Event"
      footer={
        <div className="flex justify-between w-full">
          <Button variant="danger" onClick={() => saveSlot("")}>
            Clear Slot
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditingSlot(null)}>
              Cancel
            </Button>
            <Button onClick={() => saveSlot(editingSlot?.label || "Reserved")}>Save Event</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <Input
          label="Event Name"
          value={editingSlot?.label || ""}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Morning Assembly, Staff Meeting"
          autoFocus
        />
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Presets</p>
          <div className="flex flex-wrap gap-2">
            {OCCASION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLabel(preset)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50 text-slate-600 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <label
          className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
            applyToAllDays
              ? "bg-amber-50 border-amber-300"
              : "bg-white border-slate-200 hover:bg-slate-50"
          }`}
        >
          <input
            type="checkbox"
            checked={applyToAllDays}
            onChange={(e) => setApplyToAllDays(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 mr-3"
          />
          <div>
            <p
              className={`text-sm font-bold ${applyToAllDays ? "text-amber-800" : "text-slate-700"}`}
            >
              Apply to all days
            </p>
            <p className="text-xs text-slate-500">Block this period for Monday–Friday.</p>
          </div>
        </label>
      </div>
    </Modal>
  );
};
