import React, { useState, useMemo } from "react";
import { AppData } from "../../../types";
import { Modal, Button, controlClass, quietButtonClass } from "../../../components/ui";
import { Search } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  onConfirm: (excludedIds: string[]) => void;
}

export const InvigilatorExclusionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  onConfirm,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  const sortedTeachers = useMemo(
    () => [...data.teachers].sort((a, b) => a.name.localeCompare(b.name)),
    [data.teachers],
  );

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return sortedTeachers;
    const q = searchQuery.toLowerCase();
    return sortedTeachers.filter((t) => t.name.toLowerCase().includes(q));
  }, [sortedTeachers, searchQuery]);

  const toggleTeacher = (id: string) => {
    setExcludedIds((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id],
    );
  };

  const availableCount = data.teachers.length - excludedIds.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Who can invigilate"
      maxWidth="max-w-2xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-content-muted">
            {availableCount} of {data.teachers.length} available
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => onConfirm(excludedIds)}>Assign staff</Button>
          </div>
        </div>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-3">
        <p className="text-xs leading-relaxed text-content-muted">
          Teaching is suspended during exams, so every teacher is free to invigilate. Untick anyone
          who should be left out — the rest are shared across the streams using the range on the
          toolbar.
        </p>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted"
            />
            <input
              placeholder="Search teachers"
              aria-label="Search teachers"
              className={`${controlClass} w-full pl-8`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="button" onClick={() => setExcludedIds([])} className={quietButtonClass}>
            Include all
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto rounded-md border border-edge">
          <ul className="grid grid-cols-1 sm:grid-cols-2">
            {filteredTeachers.map((t) => {
              const isIncluded = !excludedIds.includes(t.id);
              return (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 border-b border-edge-subtle px-3 py-2 hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      checked={isIncluded}
                      onChange={() => toggleTeacher(t.id)}
                      className="h-4 w-4 rounded border-edge-strong text-accent focus:ring-accent"
                    />
                    <span
                      className={`truncate text-sm ${isIncluded ? "text-content" : "text-content-muted line-through"}`}
                    >
                      {t.name}
                    </span>
                  </label>
                </li>
              );
            })}
            {filteredTeachers.length === 0 && (
              <li className="col-span-full px-3 py-6 text-center text-xs text-content-muted">
                No teacher matches that search.
              </li>
            )}
          </ul>
        </div>
      </div>
    </Modal>
  );
};
