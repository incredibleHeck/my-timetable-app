import React, { useState, useEffect, useMemo } from "react";
import {
  Trash2,
  Shield,
  Calendar,
  UserPlus,
  Layout,
  Clock,
  Wand2,
  Repeat,
  Plus,
  History,
  ArrowLeft,
  FileSpreadsheet,
  Printer,
} from "lucide-react";
import { AppData, DutyAssignment, DutyRoster, ViewState } from "../../types";
import { Button } from "../../components/ui";
import { generateId } from "../../utils/utils";
import { DAYS } from "../../utils/constants";

// Sub-components & Logic
import { DutyGeneratorModal } from "./components/DutyGeneratorModal";
import { generateDutyRoster } from "./logic/dutyGenerator";
import { exportDutyToExcel, printDutyRoster } from "../../services/export/duty";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  onNavigate?: (view: ViewState) => void;
}

export const DutyView: React.FC<ViewProps> = ({ data, onUpdate, onNavigate }) => {
  const [activeRosterId, setActiveRosterId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"ROSTER" | "SETTINGS">("ROSTER");
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [openSlot, setOpenSlot] = useState<{ row: number; col: number } | null>(null);

  // Swap Mode State
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState<{ row: number; col: number; teacherId: string } | null>(null);

  // --- MIGRATION & INITIALIZATION ---
  useEffect(() => {
    let updated = false;
    let rosters = [...(data.dutyRosters || [])];

    // 1. Migrate legacy data if it exists and no rosters are defined
    if (data.dutyAssignments?.length > 0 && rosters.length === 0) {
      const legacyRoster: DutyRoster = {
        id: generateId(),
        name: "Imported Roster",
        type: "DAILY",
        dailyAssignments: data.dutyAssignments,
        weeklyAssignments: [],
        dailyParams: { min: 4, max: 6 },
        weeklyParams: { min: 4, max: 6, weeks: 4 },
        createdAt: new Date().toISOString()
      };
      rosters = [legacyRoster];
      updated = true;
    }

    // 2. Format migration for ANY version that is missing params
    let formatChanged = false;
    const migratedRosters = rosters.map(r => {
      let changed = false;
      const copy = { ...r };

      // @ts-ignore - check for old property
      if (copy.assignments !== undefined) {
        copy.dailyAssignments = copy.type === "DAILY" ? (copy as any).assignments : [];
        copy.weeklyAssignments = copy.type === "WEEKLY" ? (copy as any).assignments : [];
        // @ts-ignore
        delete copy.assignments;
        changed = true;
      }

      if (!copy.dailyParams) {
        copy.dailyParams = { min: 4, max: (copy as any).slotCount || 6 };
        changed = true;
      }
      if (!copy.weeklyParams) {
        copy.weeklyParams = { min: 4, max: (copy as any).slotCount || 6, weeks: (copy as any).rowCount || 4 };
        changed = true;
      }
      if (!copy.dailyAssignments) {
        copy.dailyAssignments = [];
        changed = true;
      }
      if (!copy.weeklyAssignments) {
        copy.weeklyAssignments = [];
        changed = true;
      }

      if (changed) formatChanged = true;
      return copy;
    });

    if (formatChanged) {
      rosters = migratedRosters;
      updated = true;
    }

    // 3. Ensure at least one roster exists
    if (rosters.length === 0) {
      const defaultRoster: DutyRoster = {
        id: generateId(),
        name: "Standard Duty Roster",
        type: "DAILY",
        dailyAssignments: [],
        weeklyAssignments: [],
        dailyParams: { min: 4, max: 6 },
        weeklyParams: { min: 4, max: 6, weeks: 4 },
        createdAt: new Date().toISOString()
      };
      rosters = [defaultRoster];
      updated = true;
    }

    if (updated) {
      onUpdate({ 
        ...data, 
        dutyRosters: rosters,
        dutyAssignments: [] // Clear legacy field
      });
    }

    // Initialize active selection
    if (!activeRosterId && rosters.length > 0) {
      setActiveRosterId(rosters[0].id);
    }
  }, [data.dutyRosters, data.dutyAssignments]);

  // --- DERIVED DATA (SAFELY) ---
  const activeRoster = useMemo(() => {
    if (!data.dutyRosters || data.dutyRosters.length === 0) return null;
    return data.dutyRosters.find(r => r.id === activeRosterId) || data.dutyRosters[0];
  }, [data.dutyRosters, activeRosterId]);

  // IMPORTANT: Move derivation into variables that are only calculated IF activeRoster exists
  const updateActiveRoster = (updates: Partial<DutyRoster>) => {
    if (!activeRoster) return;
    const newRosters = data.dutyRosters?.map(r => 
      r.id === activeRoster.id ? { ...r, ...updates } : r
    );
    onUpdate({ ...data, dutyRosters: newRosters });
  };

  const createNewRoster = () => {
    const newRoster: DutyRoster = {
      id: generateId(),
      name: `New Roster ${data.dutyRosters?.length ? data.dutyRosters.length + 1 : 1}`,
      type: "DAILY",
      dailyAssignments: [],
      weeklyAssignments: [],
      dailyParams: { min: 4, max: 6 },
      weeklyParams: { min: 4, max: 6, weeks: 4 },
      createdAt: new Date().toISOString()
    };
    onUpdate({ ...data, dutyRosters: [...(data.dutyRosters || []), newRoster] });
    setActiveRosterId(newRoster.id);
  };

  const deleteRoster = (id: string) => {
    if (!confirm("Are you sure you want to delete this roster?")) return;
    const filtered = data.dutyRosters?.filter(r => r.id !== id) || [];
    onUpdate({ ...data, dutyRosters: filtered });
    if (activeRosterId === id) {
      setActiveRosterId(filtered[0]?.id || null);
    }
  };

  if (!activeRoster || !activeRoster.dailyParams || !activeRoster.weeklyParams) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Shield size={48} className="animate-pulse" />
          <p className="text-sm font-medium">Initializing Duty System...</p>
        </div>
      </div>
    );
  }

  // Now safe to derive values
  const currentType = activeRoster.type;
  const assignments = currentType === "DAILY" ? activeRoster.dailyAssignments || [] : activeRoster.weeklyAssignments || [];
  const activeParams = currentType === "DAILY" ? activeRoster.dailyParams : activeRoster.weeklyParams;
  const rowCount = currentType === "DAILY" ? 5 : activeRoster.weeklyParams.weeks;
  const slotCount = activeParams.max || 6;
  const rowLabels = currentType === "DAILY" ? DAYS : Array.from({ length: rowCount }, (_, i) => `Week ${i + 1}`);

  // --- GRID ACTIONS ---

  const toggleAssignment = (rowIdx: number, slotIndex: number, teacherId: string) => {
    if (isSwapMode) {
      handleSwap(rowIdx, slotIndex, teacherId);
      return;
    }

    let newAssignments = [...assignments];
    const existing = newAssignments.find(
      (a) => a.day === rowIdx && a.period === slotIndex && a.teacherId === teacherId
    );

    if (existing) {
      newAssignments = newAssignments.filter((a) => a.id !== existing.id);
    } else {
      newAssignments = newAssignments.filter(a => !(a.day === rowIdx && a.period === slotIndex));
      newAssignments.push({ id: generateId(), locationId: "general", day: rowIdx, period: slotIndex, teacherId });
    }
    
    if (currentType === "DAILY") {
      updateActiveRoster({ dailyAssignments: newAssignments });
    } else {
      updateActiveRoster({ weeklyAssignments: newAssignments });
    }
    setOpenSlot(null);
  };

  const handleSwap = (row: number, col: number, teacherId: string) => {
    if (!swapSource) {
      if (!teacherId) return;
      setSwapSource({ row, col, teacherId });
    } else {
      let newAssignments = [...assignments];
      const sourceIdx = newAssignments.findIndex(a => a.day === swapSource.row && a.period === swapSource.col);
      const targetIdx = newAssignments.findIndex(a => a.day === row && a.period === col);

      if (sourceIdx !== -1) {
        if (targetIdx !== -1) {
          const temp = newAssignments[sourceIdx].teacherId;
          newAssignments[sourceIdx].teacherId = newAssignments[targetIdx].teacherId;
          newAssignments[targetIdx].teacherId = temp;
        } else {
          newAssignments[sourceIdx].day = row;
          newAssignments[sourceIdx].period = col;
        }
      } else if (targetIdx !== -1) {
        newAssignments[targetIdx].day = swapSource.row;
        newAssignments[targetIdx].period = swapSource.col;
      }

      if (currentType === "DAILY") {
        updateActiveRoster({ dailyAssignments: newAssignments });
      } else {
        updateActiveRoster({ weeklyAssignments: newAssignments });
      }
      setSwapSource(null);
    }
  };

  const handleGenerateClick = (config: any) => {
    const newAssignments = generateDutyRoster(data, {
      ...config,
      viewType: currentType
    });
    
    if (currentType === "DAILY") {
      updateActiveRoster({
        dailyAssignments: newAssignments,
        dailyParams: { min: config.minTeachers, max: config.maxTeachers }
      });
    } else {
      updateActiveRoster({
        weeklyAssignments: newAssignments,
        weeklyParams: { min: config.minTeachers, max: config.maxTeachers, weeks: config.numWeeks }
      });
    }
    
    setGenModalOpen(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-50/50">
      {/* FULL WIDTH HEADER */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate && onNavigate("DASHBOARD")}
            className="p-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 shadow-sm transition-all"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-amber-200/50">
            <Shield size={28} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <input
                value={activeRoster.name}
                onChange={(e) => updateActiveRoster({ name: e.target.value })}
                className="text-2xl font-black text-slate-800 bg-transparent border-none p-0 focus:ring-0 w-auto min-w-[200px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-widest border border-amber-100">
                {activeRoster.type} Mode Active
              </span>
              <span className="text-slate-300">•</span>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">Created {new Date(activeRoster.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
            <button
              onClick={() => updateActiveRoster({ type: "DAILY" })}
              className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeRoster.type === "DAILY" ? "bg-amber-500 text-white shadow-md shadow-amber-200" : "text-slate-500 hover:text-slate-700"}`}
            >
              Daily
            </button>
            <button
              onClick={() => updateActiveRoster({ type: "WEEKLY" })}
              className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeRoster.type === "WEEKLY" ? "bg-amber-500 text-white shadow-md shadow-amber-200" : "text-slate-500 hover:text-slate-700"}`}
            >
              Weekly
            </button>
          </div>

          <div className="h-8 w-px bg-slate-200" />

          <button
            onClick={() => setIsSwapMode(!isSwapMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
              isSwapMode ? "bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm"
            }`}
          >
            <Repeat size={14} className={isSwapMode ? "animate-spin-slow" : ""} />
            {isSwapMode ? "Swap On" : "Swap Off"}
          </button>

          <Button
            size="md"
            variant="primary"
            icon={<Wand2 size={16} />}
            onClick={() => setGenModalOpen(true)}
            className="shadow-lg shadow-amber-100"
          >
            Auto-Generate
          </Button>

          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100 ml-2">
            <button
              onClick={() => exportDutyToExcel(data, activeRoster)}
              className="p-2 text-slate-500 hover:text-amber-600 transition-colors"
              title="Export to Excel"
            >
              <FileSpreadsheet size={20} />
            </button>
            <button
              onClick={() => printDutyRoster(data, activeRoster)}
              className="p-2 text-slate-500 hover:text-amber-600 transition-colors"
              title="Print PDF"
            >
              <Printer size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR: SAVED ROSTERS */}
        <div className="w-[248px] bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <div className="flex items-center gap-2">
              <History size={18} className="text-slate-400" />
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">History</h3>
            </div>
            <button 
              onClick={createNewRoster}
              className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors border border-amber-100 shadow-sm"
              title="Create New Roster"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {data.dutyRosters?.map(r => (
              <div 
                key={r.id}
                onClick={() => setActiveRosterId(r.id)}
                className={`group relative p-4 rounded-xl border transition-all cursor-pointer ${
                  activeRosterId === r.id 
                    ? "bg-amber-50/50 border-amber-200 shadow-sm" 
                    : "bg-white border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex flex-col gap-1 pr-6">
                  <span className={`text-xs font-black uppercase tracking-tight ${activeRosterId === r.id ? "text-amber-800" : "text-slate-700"}`}>
                    {r.name}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{r.type}</span>
                    <span>{r.type === "DAILY" ? (r.dailyAssignments?.length || 0) : (r.weeklyAssignments?.length || 0)} Staff</span>
                  </div>
                </div>
                
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteRoster(r.id); }}
                  className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>

                {activeRosterId === r.id && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-500 rounded-l-full" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* MAIN GRID AREA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50/30">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                <button
                  onClick={() => setActiveTab("ROSTER")}
                  className={`px-6 py-2 text-xs font-black uppercase rounded-lg transition-all ${activeTab === "ROSTER" ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Grid View
                </button>
                <button
                  onClick={() => setActiveTab("SETTINGS")}
                  className={`px-6 py-2 text-xs font-black uppercase rounded-lg transition-all ${activeTab === "SETTINGS" ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Info & Stats
                </button>
              </div>
            </div>

            {activeTab === "SETTINGS" && (
              <div className="bg-white rounded-[2rem] border border-slate-200 p-12 text-center space-y-6 shadow-sm">
                <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-500 shadow-inner">
                  {currentType === "DAILY" ? <Clock size={40} /> : <Calendar size={40} />}
                </div>
                <div className="space-y-2">
                  <h3 className="font-black text-slate-800 text-2xl uppercase tracking-tight">
                    {currentType === "DAILY" ? "Daily Rotation" : "Weekly Rotation"}
                  </h3>
                  <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                    {currentType === "DAILY" 
                      ? "This mode schedules staff for each day of the week. The generator ensures staff appear only once in the 5-day cycle."
                      : `This mode schedules staff for a ${activeRoster.weeklyParams?.weeks || 0}-week block. The generator ensures staff are rotated fairly across all weeks.`
                    }
                  </p>
                </div>
              </div>
            )}

            {activeTab === "ROSTER" && (
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/20 overflow-hidden flex flex-col">
                <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center px-8">
                   <div className="flex items-center gap-3">
                      <Layout size={18} className="text-amber-500" />
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        {rowCount} Rows • {slotCount} Columns
                      </span>
                   </div>
                   <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-slate-200" />
                      <div className="w-2 h-2 rounded-full bg-slate-300" />
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                   </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/30 border-b border-slate-200">
                      <tr>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r bg-slate-50/50 w-40 sticky left-0 z-10 backdrop-blur-md">
                          {currentType === "DAILY" ? "Day Index" : "Week Cycle"}
                        </th>
                        {Array.from({ length: slotCount }).map((_, i) => (
                          <th key={i} className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center min-w-[180px]">
                            Slot {i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rowLabels.map((label, rIdx) => (
                        <tr key={label} className="group hover:bg-slate-50/30 transition-colors">
                          <td className="p-6 border-r whitespace-nowrap bg-slate-50/50 sticky left-0 z-10 font-black text-slate-600 text-xs uppercase tracking-tighter">
                            {label}
                          </td>
                          {Array.from({ length: slotCount }).map((_, slotIdx) => {
                            const assignment = assignments.find(
                              (a) => a.day === rIdx && a.period === slotIdx
                            );
                            const assignedTeacher = data.teachers.find(t => t.id === assignment?.teacherId);
                            const isDropdownOpen = openSlot?.row === rIdx && openSlot?.col === slotIdx;
                            const isSwapSource = swapSource?.row === rIdx && swapSource?.col === slotIdx;

                            return (
                              <td key={slotIdx} className="p-4 border-r border-slate-50 last:border-r-0 h-28">
                                <div className="relative flex flex-col items-center justify-center h-full">
                                  {assignedTeacher ? (
                                    <div 
                                      onClick={() => isSwapMode && handleSwap(rIdx, slotIdx, assignedTeacher.id)}
                                      className={`w-full h-full flex flex-col justify-center border p-4 rounded-2xl transition-all shadow-sm ${
                                        isSwapSource
                                          ? "bg-amber-500 border-amber-600 text-white scale-105 z-20 shadow-xl rotate-1"
                                          : isSwapMode 
                                            ? "bg-white border-amber-200 cursor-pointer hover:border-amber-500 hover:shadow-md"
                                            : "bg-white border-slate-100 hover:border-slate-300"
                                      }`}
                                    >
                                      <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[11px] font-black uppercase tracking-tight ${isSwapSource ? "text-white" : "text-slate-800"}`}>
                                          {assignedTeacher.name}
                                        </span>
                                        {!isSwapMode && (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); toggleAssignment(rIdx, slotIdx, assignedTeacher.id); }}
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${isSwapSource ? "bg-white animate-pulse" : "bg-emerald-500"}`} />
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${isSwapSource ? "text-amber-50" : "text-slate-400"}`}>
                                          {isSwapSource ? "Swapping..." : "Active"}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative w-full h-full">
                                      <button 
                                        onClick={() => isSwapMode ? handleSwap(rIdx, slotIdx, "") : setOpenSlot({ row: rIdx, col: slotIdx })}
                                        className={`w-full h-full border-2 border-dashed rounded-2xl flex items-center justify-center transition-all ${
                                          isDropdownOpen 
                                            ? "border-amber-400 bg-amber-50 text-amber-500" 
                                            : isSwapMode
                                              ? "border-amber-100 bg-amber-50/20 text-amber-200"
                                              : "border-slate-100 text-slate-200 hover:border-slate-300 hover:text-slate-400 hover:bg-slate-50"
                                        }`}
                                      >
                                        <UserPlus size={24} />
                                      </button>
                                      
                                      {isDropdownOpen && !isSwapMode && (
                                        <>
                                          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setOpenSlot(null)} />
                                          <div className="absolute top-full left-0 z-50 w-64 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl overflow-hidden mt-3 p-1 animate-in slide-in-from-top-2 duration-300">
                                            <div className="p-4 text-[10px] font-black text-slate-400 uppercase border-b bg-slate-50/50 rounded-t-[1rem] sticky top-0 backdrop-blur-sm">Staff Selection</div>
                                            <div className="max-h-64 overflow-y-auto custom-scrollbar p-1 space-y-1">
                                              {data.teachers.sort((a,b)=>a.name.localeCompare(b.name)).map(t => {
                                                const isAssignedThisCycle = assignments.some(a => a.teacherId === t.id);
                                                const isAssignedThisRow = assignments.some(a => a.teacherId === t.id && a.day === rIdx);
                                                
                                                return (
                                                  <button
                                                    key={t.id}
                                                    onClick={() => toggleAssignment(rIdx, slotIdx, t.id)}
                                                    className={`w-full text-left px-3 py-3 text-[11px] font-bold flex justify-between items-center rounded-xl transition-all ${
                                                      isAssignedThisCycle 
                                                        ? "bg-slate-50 text-slate-300 opacity-60" 
                                                        : "text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                                                    }`}
                                                  >
                                                    <span className="truncate">{t.name}</span>
                                                    {isAssignedThisRow && <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-lg uppercase">Selected</span>}
                                                    {isAssignedThisCycle && !isAssignedThisRow && <span className="text-[8px] font-black bg-slate-100 text-slate-400 px-2 py-1 rounded-lg uppercase">Other Row</span>}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <DutyGeneratorModal
        isOpen={genModalOpen}
        onClose={() => setGenModalOpen(false)}
        data={data}
        viewType={currentType}
        initialParams={{
          min: activeParams?.min || 4,
          max: activeParams?.max || 6,
          weeks: activeRoster.weeklyParams?.weeks || 4
        }}
        onGenerate={handleGenerateClick}
      />
    </div>
  );
};
