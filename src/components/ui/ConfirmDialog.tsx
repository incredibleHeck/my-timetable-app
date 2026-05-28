import React, { useId } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}) => {
  const messageId = useId();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      descriptionId={messageId}
      footer={
        <div className="flex gap-3 w-full justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p id={messageId} className="text-slate-600">
        {message}
      </p>
    </Modal>
  );
};
