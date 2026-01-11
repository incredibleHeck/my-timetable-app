import React from "react";
import { Save, Zap, AlertCircle } from "lucide-react";

interface SystemStatusProps {
  isSaving: boolean;
  isGenerating: boolean;
  hasConflicts: boolean;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
  isSaving,
  isGenerating,
  hasConflicts,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Auto-save Status */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
        isSaving 
          ? "bg-amber-500/10 border-amber-500/20 text-amber-500" 
          : "bg-white/5 border-white/10 text-slate-400"
      }`}>
        <Save size={14} className={isSaving ? "animate-bounce" : ""} />
        {isSaving ? "Auto-saving..." : "All Changes Saved"}
      </div>

      {/* Scheduler Status */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
        isGenerating 
          ? "bg-blue-500/10 border-blue-500/20 text-blue-400" 
          : "bg-white/5 border-white/10 text-slate-400"
      }`}>
        <Zap size={14} className={isGenerating ? "animate-pulse fill-blue-400" : ""} />
        {isGenerating ? "Scheduler Running" : "Scheduler Idle"}
      </div>

      {/* Conflict Warning */}
      {hasConflicts && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold animate-in zoom-in duration-300">
          <AlertCircle size={14} />
          Conflicts Detected
        </div>
      )}
    </div>
  );
};
