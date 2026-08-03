import React, { useState } from "react";
import { Modal, Button, Input } from "../../../components/ui";
import { AppData } from "../../../types";
import { DEFAULT_DATA } from "../../../utils/constants";

interface ProfileWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, templateData?: AppData) => Promise<void>;
}

export const ProfileWizard: React.FC<ProfileWizardProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreate(name, DEFAULT_DATA);
      setName("");
      onClose();
    } catch (error) {
      console.error("Failed to create profile:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Profile"
      aria-label="Create New Profile"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} isLoading={isSubmitting} disabled={!name.trim()}>
            Create Profile
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-content-muted">
          Create a clean slate for a new semester or academic year.
        </p>
        <Input
          label="Profile Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 2nd Semester 2025"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          disabled={isSubmitting}
        />
      </div>
    </Modal>
  );
};
