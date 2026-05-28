import React from "react";
import {
  Play,
  Users,
  BookOpen,
  Printer,
  Recycle,
  Lock,
  Unlock,
  ArrowLeft,
  FileSpreadsheet,
  Square,
  Plus,
} from "lucide-react";
import { AppData } from "../../../types";
import { Button } from "../../../components/ui";

export interface GeneratorStats {
  iterations: number;
  duration: number;
  runIndex: number;
  totalRuns: number;
  unplaced: number;
  perfectRuns: number;
}

interface GeneratorToolbarProps {
  data: AppData;
  mode: "CLASS" | "TEACHER";
  isGenerating: boolean;
  isEditMode: boolean;
  isManualPlacementMode: boolean;
  stats: GeneratorStats | null;
  onNavigate?: (view: import("../../../types").ViewState) => void;
  onModeChange: (mode: "CLASS" | "TEACHER") => void;
  onToggleEditMode: () => void;
  onToggleManualPlacement: () => void;
  onGenerate: () => void;
  onStop: () => void;
  onExcelExport: () => void;
  onPrint: () => void;
}

export const GeneratorToolbar: React.FC<GeneratorToolbarProps> = ({
  data,
  mode,
  isGenerating,
  isEditMode,
  isManualPlacementMode,
  stats,
  onNavigate,
  onModeChange,
  onToggleEditMode,
  onToggleManualPlacement,
  onGenerate,
  onStop,
  onExcelExport,
  onPrint,
}) => (
  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
    <div className="flex flex-col md:flex-row md:items-center gap-6">
      <button
        onClick={() => onNavigate && onNavigate("DASHBOARD")}
        className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500"
        aria-label="Back to dashboard"
      >
        <ArrowLeft size={20} />
      </button>
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          Auto-Scheduler
          {data.lastGenerated && !isGenerating && (
            <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Last run: {new Date(data.lastGenerated).toLocaleTimeString()}
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
          <span>v10.0 (Worker-Enabled)</span>
          {stats && (
            <>
              <span className="text-emerald-600 font-medium">
                • {(stats.duration / 1000).toFixed(1)}s
              </span>
              <span className="text-slate-400">
                • {stats.totalRuns} run{stats.totalRuns !== 1 ? "s" : ""}
              </span>
              <span className="text-slate-400">• {stats.iterations.toLocaleString()} moves</span>
              {stats.perfectRuns > 0 && (
                <span className="text-emerald-600 font-medium">• {stats.perfectRuns} perfect</span>
              )}
              {stats.unplaced === 0 ? (
                <span className="text-emerald-600 font-medium">• fully placed</span>
              ) : (
                <span className="text-amber-600 font-medium">• {stats.unplaced} unplaced</span>
              )}
            </>
          )}
        </p>
      </div>
      <div
        className="flex bg-slate-200 p-1 rounded-lg"
        role="group"
        aria-label="Schedule view mode"
      >
        <button
          onClick={() => onModeChange("CLASS")}
          disabled={isGenerating}
          aria-pressed={mode === "CLASS"}
          className={`px-4 py-2 text-xs font-bold rounded-md flex items-center gap-2 transition-all ${
            mode === "CLASS" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
          }`}
        >
          <BookOpen size={14} /> Classes
        </button>
        <button
          onClick={() => onModeChange("TEACHER")}
          disabled={isGenerating}
          aria-pressed={mode === "TEACHER"}
          className={`px-4 py-2 text-xs font-bold rounded-md flex items-center gap-2 transition-all ${
            mode === "TEACHER" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
          }`}
        >
          <Users size={14} /> Teachers
        </button>
      </div>
      <div className="flex items-center gap-2 pl-6 border-l border-slate-200">
        <button
          onClick={onToggleEditMode}
          disabled={isGenerating}
          aria-pressed={isEditMode}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
            isEditMode
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-white text-slate-500 border-slate-200"
          }`}
        >
          {isEditMode ? <Unlock size={14} /> : <Lock size={14} />}
          {isEditMode ? "Disable Edit" : "Enable Edit"}
        </button>
        {isEditMode && mode === "CLASS" && (
          <button
            onClick={onToggleManualPlacement}
            disabled={isGenerating}
            aria-pressed={isManualPlacementMode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              isManualPlacementMode
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white text-slate-500 border-slate-200"
            }`}
          >
            <Plus size={14} />
            {isManualPlacementMode ? "Manual Placement On" : "Manual Placement"}
          </button>
        )}
      </div>
    </div>

    <div className="flex gap-3">
      {isGenerating ? (
        <Button
          onClick={onStop}
          variant="danger"
          size="md"
          icon={<Square size={16} fill="currentColor" />}
        >
          Stop Solver
        </Button>
      ) : (
        <Button
          onClick={onGenerate}
          size="md"
          icon={data.lastGenerated ? <Recycle size={16} /> : <Play size={16} />}
        >
          {data.lastGenerated ? "Regenerate" : "Generate Schedule"}
        </Button>
      )}

      <Button
        onClick={onExcelExport}
        disabled={isGenerating}
        icon={<FileSpreadsheet size={16} />}
        aria-label={
          mode === "CLASS" ? "Export all classes to Excel" : "Export all teachers to Excel"
        }
      />

      <Button
        onClick={onPrint}
        disabled={isGenerating}
        icon={<Printer size={16} />}
        aria-label="Print all schedules"
      />
    </div>
  </div>
);
