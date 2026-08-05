import React from "react";
import { ArrowLeft, Play, Recycle, FileSpreadsheet, Square, History } from "lucide-react";
import { AppData } from "../../../types";
import { Button, quietButtonClass } from "../../../components/ui";
import { ExportMenu } from "./ExportMenu";
import { PrintMode } from "../../../services/export/print";

export interface GeneratorStats {
  iterations: number;
  duration: number;
  runIndex: number;
  totalRuns: number;
  unplaced: number;
  perfectRuns: number;
}

type Mode = "CLASS" | "TEACHER" | "ROOM";

const MODES: { id: Mode; label: string }[] = [
  { id: "CLASS", label: "Classes" },
  { id: "TEACHER", label: "Teachers" },
  { id: "ROOM", label: "Rooms" },
];

interface GeneratorToolbarProps {
  data: AppData;
  mode: Mode;
  isGenerating: boolean;
  stats: GeneratorStats | null;
  onNavigate?: (view: import("../../../types").ViewState) => void;
  onModeChange: (mode: Mode) => void;
  onGenerate: () => void;
  onStop: () => void;
  onExcelExport: () => void;
  onPrint: (target: PrintMode, entityId?: string) => void;
  onExportICal: (target: "CLASS" | "TEACHER", entityId: string) => void;
  canRestore?: boolean;
  onRestore?: () => void;
}

export const GeneratorToolbar: React.FC<GeneratorToolbarProps> = ({
  data,
  mode,
  isGenerating,
  stats,
  onNavigate,
  onModeChange,
  onGenerate,
  onStop,
  onExcelExport,
  onPrint,
  onExportICal,
  canRestore,
  onRestore,
}) => (
  <div className="mb-5 flex flex-col gap-3 print:hidden">
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-start gap-3">
        {/* The full-width workspace screens — this one, Exam Timetable and Duty
            Roster — each carry a way back out. Dropping it here left the
            timetable as the only one you could not step out of. */}
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate("DASHBOARD")}
            className={`${quietButtonClass} w-9 shrink-0 justify-center px-0`}
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft size={16} aria-hidden />
          </button>
        )}
        <div className="min-w-0">
          {/* The page called itself "Auto-Scheduler" while the nav called it
              "Auto-Generator", and printed its build string underneath. */}
          <h2 className="text-lg font-semibold tracking-tight text-content">Auto-Generator</h2>
          <p className="mt-1 text-xs text-content-muted">
            {data.lastGenerated ? (
              <>
                Last run {new Date(data.lastGenerated).toLocaleTimeString()}
                {stats && (
                  <>
                    {" · "}
                    <span className="tabular-nums">{(stats.duration / 1000).toFixed(1)}s</span>
                    {" · "}
                    {stats.unplaced === 0 ? (
                      <span className="text-success-ink">every lesson placed</span>
                    ) : (
                      <span className="text-accent-ink">
                        <span className="tabular-nums">{stats.unplaced}</span> unplaced
                      </span>
                    )}
                  </>
                )}
              </>
            ) : (
              "No timetable generated yet."
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canRestore && onRestore && (
          <button
            type="button"
            onClick={onRestore}
            className={quietButtonClass}
            title="Restore the schedule from before the last regeneration"
          >
            <History size={14} aria-hidden />
            Restore previous
          </button>
        )}
        {isGenerating ? (
          <Button onClick={onStop} variant="danger" icon={<Square size={14} fill="currentColor" />}>
            Stop Solver
          </Button>
        ) : (
          <Button
            onClick={onGenerate}
            icon={data.lastGenerated ? <Recycle size={16} /> : <Play size={16} />}
          >
            {data.lastGenerated ? "Regenerate" : "Generate Schedule"}
          </Button>
        )}

        <button
          type="button"
          onClick={onExcelExport}
          disabled={isGenerating}
          className={`${quietButtonClass} w-9 justify-center px-0`}
          title={
            mode === "CLASS"
              ? "Export all classes to Excel"
              : mode === "TEACHER"
                ? "Export all teachers to Excel"
                : "Export all rooms to Excel"
          }
          aria-label={
            mode === "CLASS"
              ? "Export all classes to Excel"
              : mode === "TEACHER"
                ? "Export all teachers to Excel"
                : "Export all rooms to Excel"
          }
        >
          <FileSpreadsheet size={15} aria-hidden />
        </button>

        <ExportMenu
          data={data}
          disabled={isGenerating}
          onPrint={onPrint}
          onExportICal={onExportICal}
        />
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      {/* The grid is directly editable, so this is the only mode left: which
          timetable you are looking at. */}
      <div
        role="group"
        aria-label="Schedule view mode"
        className="inline-flex h-9 items-center rounded-md border border-edge bg-surface p-0.5"
      >
        {MODES.map((m) => {
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onModeChange(m.id)}
              disabled={isGenerating}
              aria-pressed={isActive}
              className={`h-8 rounded px-3 text-sm transition-colors focus-visible:outline-none
                          focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${
                            isActive
                              ? "bg-surface-inset font-medium text-content dark:bg-slate-700"
                              : "text-content-muted hover:text-content"
                          }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);
