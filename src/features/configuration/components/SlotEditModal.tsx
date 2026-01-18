import React from "react";
import { Check } from "lucide-react";
import { Modal, Button, Input } from "../../../components/ui";

interface SlotEditModalProps {
  editingSlot: { dIdx: number; pIdx: number; label: string } | null;
  setEditingSlot: (slot: { dIdx: number; pIdx: number; label: string } | null) => void;
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
          onChange={(e) =>
            setEditingSlot(editingSlot ? { ...editingSlot, label: e.target.value } : null)
          }
          placeholder="e.g. Morning Assembly, Staff Meeting"
          autoFocus
        />
        <div
          className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
            applyToAllDays ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200 hover:bg-slate-50"
          }`}
          onClick={() => setApplyToAllDays(!applyToAllDays)}
        >
          <div
            className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${
              applyToAllDays ? "bg-amber-500 border-amber-500" : "bg-white border-slate-300"
            }`}
          >
            {applyToAllDays && <Check size={14} className="text-white" />}
          </div>
          <div>
            <p className={`text-sm font-bold ${applyToAllDays ? "text-amber-800" : "text-slate-700"}`}>
              Apply to all days
            </p>
            <p className="text-xs text-slate-500">Block this period for Monday–Friday.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
