import React from "react";
import { Plus, FolderOpen, Download, Upload, UserCircle } from "lucide-react";
import { Card, Button } from "../../../components/ui";

interface ProfileActionsProps {
  onSaveNew: () => void;
  onLoadExisting: () => void;
  onImport: () => void;
  onExport: () => void;
  activeProfileName: string;
}

export const ProfileActions: React.FC<ProfileActionsProps> = ({
  onSaveNew,
  onLoadExisting,
  onImport,
  onExport,
  activeProfileName,
}) => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div className="p-2 bg-amber-100 text-accent-ink rounded-lg">
          <UserCircle size={20} />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Profile Management</h3>
          <p className="text-xs text-content-muted">Current: {activeProfileName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <p className="text-2xs font-bold text-content-muted uppercase tracking-widest px-1">
            Local Profiles
          </p>
          <div className="flex flex-col gap-2">
            <Button
              icon={<Plus size={16} />}
              onClick={onSaveNew}
              variant="secondary"
              className="justify-start h-11"
            >
              Save As New Profile
            </Button>
            <Button
              icon={<FolderOpen size={16} />}
              onClick={onLoadExisting}
              variant="secondary"
              className="justify-start h-11"
            >
              Switch / Load Profile
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-2xs font-bold text-content-muted uppercase tracking-widest px-1">
            Backup & Sync
          </p>
          <div className="flex flex-col gap-2">
            <Button
              icon={<Upload size={16} />}
              onClick={onExport}
              variant="secondary"
              className="justify-start h-11"
            >
              Export to File (.json)
            </Button>
            <Button
              icon={<Download size={16} />}
              onClick={onImport}
              variant="secondary"
              className="justify-start h-11"
            >
              Import from File
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
