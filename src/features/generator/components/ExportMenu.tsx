import React, { useEffect, useRef, useState } from "react";
import { Download, Printer, CalendarDays } from "lucide-react";
import { AppData } from "../../../types";
import { PrintMode } from "../../../services/export/print";

interface ExportMenuProps {
  data: AppData;
  disabled?: boolean;
  onPrint: (target: PrintMode, entityId?: string) => void;
  onExportICal: (target: "CLASS" | "TEACHER", entityId: string) => void;
}

const TARGETS: { value: PrintMode; label: string }[] = [
  { value: "CLASS", label: "Classes" },
  { value: "TEACHER", label: "Teachers" },
  { value: "ROOM", label: "Rooms" },
];

export const ExportMenu: React.FC<ExportMenuProps> = ({
  data,
  disabled,
  onPrint,
  onExportICal,
}) => {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<PrintMode>("CLASS");
  const [entityId, setEntityId] = useState<string>("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const entities =
    target === "CLASS" ? data.classes : target === "TEACHER" ? data.teachers : data.rooms;

  const handleTargetChange = (next: PrintMode) => {
    setTarget(next);
    setEntityId("");
  };

  const icalDisabled = target === "ROOM" || entityId === "";

  const handlePrint = () => {
    onPrint(target, entityId || undefined);
    setOpen(false);
  };

  const handleICal = () => {
    if (icalDisabled) return;
    onExportICal(target as "CLASS" | "TEACHER", entityId);
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export and print options"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <Download size={16} />
        <span className="text-xs font-bold">Export</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-lg"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Target
          </p>
          <div
            className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-3"
            role="group"
            aria-label="Export target"
          >
            {TARGETS.map((t) => (
              <button
                key={t.value}
                onClick={() => handleTargetChange(t.value)}
                aria-pressed={target === t.value}
                className={`flex-1 px-2 py-1.5 text-xs font-bold rounded-md transition-all ${
                  target === t.value
                    ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Scope
          </p>
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="w-full mb-3 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-amber-400 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800"
          >
            <option value="">All {target.toLowerCase()}s</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-all"
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={handleICal}
              disabled={icalDisabled}
              title={
                icalDisabled
                  ? "Pick a single class or teacher to export a calendar"
                  : "Export a subscribable .ics calendar"
              }
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <CalendarDays size={14} /> .ics
            </button>
          </div>
          {icalDisabled && (
            <p className="text-[10px] text-slate-400 mt-2">
              Calendar export needs a single class or teacher selected.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
