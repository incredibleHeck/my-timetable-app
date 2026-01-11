import React from "react";
import { Save, Trash2 } from "lucide-react";
import { Modal, Button, Input } from "../../../components/ui";

interface ProfileModalsProps {
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  loadOpen: boolean;
  setLoadOpen: (open: boolean) => void;
  newProfileName: string;
  setNewProfileName: (name: string) => void;
  savedProfiles: { id: string; name: string }[];
  onCreate: () => void;
  onLoad: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const ProfileModals: React.FC<ProfileModalsProps> = ({
  createOpen,
  setCreateOpen,
  loadOpen,
  setLoadOpen,
  newProfileName,
  setNewProfileName,
  savedProfiles,
  onCreate,
  onLoad,
  onDelete,
}) => {
  return (
    <>
      {/* CREATE PROFILE MODAL */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Save New Profile (Local)"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate} icon={<Save size={16} />}>
              Save Profile
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Create a new profile based on your current data. This will be saved to local storage.
          </p>
          <Input
            label="Profile Name"
            placeholder="e.g. Term 1 Draft 2"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* LOAD PROFILE MODAL */}
      <Modal
        isOpen={loadOpen}
        onClose={() => setLoadOpen(false)}
        title="Switch Profile"
        footer={
          <div className="flex justify-end w-full">
            <Button variant="secondary" onClick={() => setLoadOpen(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Select a saved profile to load. Unsaved changes in your current session will be lost if auto-save is off.
          </p>
          {savedProfiles.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-lg border border-slate-200 border-dashed">
              No saved profiles found.
            </div>
          ) : (
            <div className="grid gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
              {savedProfiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-amber-400 transition-colors group"
                >
                  <span className="font-bold text-slate-700">{p.name}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" onClick={() => onLoad(p.id)}>
                      Switch
                    </Button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(p.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete Profile"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
