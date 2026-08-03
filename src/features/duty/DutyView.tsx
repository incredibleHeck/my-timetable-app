import React, { useState } from "react";
import {
  Trash2,
  Shield,
  Calendar,
  UserPlus,
  Layout,
  Clock,
  Wand2,
  Plus,
  History,
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  Lock,
  Unlock,
  Pencil,
} from "lucide-react";
import { AppData, ViewState } from "../../types";
import { Button } from "../../components/ui";
import { generateId } from "../../utils/utils";
import { DAYS } from "../../utils/constants";

// Sub-components & Logic
import { DutyGeneratorModal } from "./components/DutyGeneratorModal";
import { generateDutyRoster } from "./logic/dutyGenerator";
import { exportDutyToExcel, printDutyRoster } from "../../services/export/duty";
import { useDutyRosters } from "./hooks/useDutyRosters";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  onNavigate?: (view: ViewState) => void;
}

export const DutyView: React.FC<ViewProps> = ({ data, onUpdate, onNavigate }) => {
  const {
    activeRosterId,
    setActiveRosterId,
    activeRoster,
    updateActiveRoster,
    createNewRoster,
    deleteRoster,
  } = useDutyRosters(data, onUpdate);

  const [activeTab, setActiveTab] = useState<"ROSTER" | "SETTINGS">("ROSTER");
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [openSlot, setOpenSlot] = useState<{ row: number; col: number } | null>(null);

  const [isSwapMode, setIsSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState<{
    row: number;
    col: number;
    teacherId: string;
  } | null>(null);

  if (!activeRoster || !activeRoster.dailyParams || !activeRoster.weeklyParams) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4 text-content-muted">
          <Shield size={48} className="animate-pulse" />
          <p className="text-sm font-medium">Initializing Duty System...</p>
        </div>
      </div>
    );
  }

  // Now safe to derive values
  const currentType = activeRoster.type;
  const assignments =
    currentType === "DAILY"
      ? activeRoster.dailyAssignments || []
      : activeRoster.weeklyAssignments || [];
  const activeParams =
    currentType === "DAILY" ? activeRoster.dailyParams : activeRoster.weeklyParams;
  const rowCount = currentType === "DAILY" ? 5 : activeRoster.weeklyParams.weeks;
  const slotCount = activeParams.max || 6;
  const rowLabels =
    currentType === "DAILY" ? DAYS : Array.from({ length: rowCount }, (_, i) => `Week ${i + 1}`);

  // --- GRID ACTIONS ---

  const toggleAssignment = (rowIdx: number, slotIndex: number, teacherId: string) => {
    if (isSwapMode) {
      handleSwap(rowIdx, slotIndex, teacherId);
      return;
    }

    let newAssignments = [...assignments];
    const existing = newAssignments.find(
      (a) => a.day === rowIdx && a.period === slotIndex && a.teacherId === teacherId,
    );

    if (existing) {
      newAssignments = newAssignments.filter((a) => a.id !== existing.id);
    } else {
      // Prevent manual double assignment if already assigned elsewhere in this roster
      const duplicate = newAssignments.find((a) => a.teacherId === teacherId);
      if (duplicate) {
        const teacherName = data.teachers.find((t) => t.id === teacherId)?.name || "Teacher";
        const dayName = rowLabels[duplicate.day] || "another slot";
        if (
          !confirm(`${teacherName} is already assigned to ${dayName}. Allow double assignment?`)
        ) {
          setOpenSlot(null);
          return;
        }
      }

      newAssignments = newAssignments.filter((a) => !(a.day === rowIdx && a.period === slotIndex));
      newAssignments.push({
        id: generateId(),
        locationId: "general",
        day: rowIdx,
        period: slotIndex,
        teacherId,
      });
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
      const newAssignments = [...assignments];
      const sourceIdx = newAssignments.findIndex(
        (a) => a.day === swapSource.row && a.period === swapSource.col,
      );
      const targetIdx = newAssignments.findIndex((a) => a.day === row && a.period === col);

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

  const handleGenerateClick = (config: {
    numWeeks: number;
    minTeachers: number;
    maxTeachers: number;
    excludedTeacherIds: string[];
  }) => {
    const newAssignments = generateDutyRoster(data, {
      ...config,
      viewType: currentType,
    });

    if (currentType === "DAILY") {
      updateActiveRoster({
        dailyAssignments: newAssignments,
        dailyParams: { min: config.minTeachers, max: config.maxTeachers },
      });
    } else {
      updateActiveRoster({
        weeklyAssignments: newAssignments,
        weeklyParams: { min: config.minTeachers, max: config.maxTeachers, weeks: config.numWeeks },
      });
    }

    setGenModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* HEADER TOOLBAR */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-4 z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-2 flex-1">
          {/* Back Button */}
          <button
            onClick={() => onNavigate && onNavigate("DASHBOARD")}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-content-muted mr-2"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex flex-col">
            <div className="flex items-center group/title relative">
              <input
                value={activeRoster.name}
                onChange={(e) => updateActiveRoster({ name: e.target.value })}
                className="text-xl font-bold text-slate-800 dark:text-slate-100 bg-transparent border-none p-0 focus:ring-0 w-auto min-w-[200px] hover:bg-slate-50 rounded px-1 transition-colors"
              />
              <Pencil
                size={12}
                className="text-slate-300 ml-1 opacity-0 group-hover/title:opacity-100 transition-opacity pointer-events-none"
              />
            </div>
            <p className="text-2xs text-content-muted font-bold uppercase tracking-tight">
              Duty Roster Management
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg ml-6">
            <button
              onClick={() => updateActiveRoster({ type: "DAILY" })}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeRoster.type === "DAILY"
                  ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-content-muted hover:text-slate-700"
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => updateActiveRoster({ type: "WEEKLY" })}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeRoster.type === "WEEKLY"
                  ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-content-muted hover:text-slate-700"
              }`}
            >
              Weekly
            </button>
          </div>

          {/* Edit Mode Toggles */}
          <div className="flex items-center gap-2 pl-6 border-l border-slate-200 dark:border-slate-700 ml-6">
            <button
              onClick={() => setIsSwapMode(!isSwapMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                isSwapMode
                  ? "bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-content-muted border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              }`}
              title={isSwapMode ? "Disable Drag & Drop" : "Enable Drag & Drop"}
            >
              {isSwapMode ? <Unlock size={14} /> : <Lock size={14} />}
              {isSwapMode ? "Disable Edit" : "Enable Edit"}
            </button>
          </div>

          {/* View Toggles */}
          <div className="flex items-center gap-4 ml-auto border-l border-slate-200 dark:border-slate-700 pl-6">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("ROSTER")}
                className={`px-4 py-1.5 text-2xs font-black uppercase rounded-md transition-all ${
                  activeTab === "ROSTER"
                    ? "bg-white dark:bg-slate-800 text-accent-ink shadow-sm"
                    : "text-content-muted hover:text-slate-600"
                }`}
                title="Grid View"
              >
                Grid
              </button>
              <button
                onClick={() => setActiveTab("SETTINGS")}
                className={`px-4 py-1.5 text-2xs font-black uppercase rounded-md transition-all ${
                  activeTab === "SETTINGS"
                    ? "bg-white dark:bg-slate-800 text-accent-ink shadow-sm"
                    : "text-content-muted hover:text-slate-600"
                }`}
                title="Info & Stats"
              >
                Info
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="md"
            variant="primary"
            icon={<Wand2 size={16} />}
            onClick={() => setGenModalOpen(true)}
          >
            Auto-Generate
          </Button>

          <Button
            onClick={() => exportDutyToExcel(data, activeRoster)}
            icon={<FileSpreadsheet size={16} />}
            title="Export to Excel"
          />
          <Button
            onClick={() => printDutyRoster(data, activeRoster)}
            icon={<Printer size={16} />}
            title="Print PDF"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR: HISTORY (Rosters) */}
        <div className="w-48 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full shrink-0 shadow-[inset_-1px_0_0_rgba(0,0,0,0.05)]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <History size={16} className="text-content-muted" />
              <span className="text-2xs font-black text-content-muted uppercase tracking-wider">
                Rosters
              </span>
            </div>
            <button
              onClick={createNewRoster}
              className="p-1 bg-white dark:bg-slate-800 text-accent-ink rounded border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:bg-amber-900/30 transition-all shadow-sm"
              title="New Roster"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {data.dutyRosters?.map((r) => (
              <div
                key={r.id}
                onClick={() => setActiveRosterId(r.id)}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                  activeRosterId === r.id
                    ? "bg-white dark:bg-slate-800 border-amber-200 shadow-md ring-1 ring-amber-100"
                    : "bg-transparent border-transparent hover:bg-white hover:border-slate-200"
                }`}
              >
                <div className="flex flex-col gap-0.5 pr-6">
                  <span
                    className={`text-[11px] font-black truncate ${activeRosterId === r.id ? "text-amber-800 dark:text-amber-200" : "text-slate-600 dark:text-slate-300"}`}
                  >
                    {r.name}
                  </span>
                  <div className="flex items-center gap-2 text-2xs font-bold text-content-muted">
                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-content-muted uppercase">
                      {r.type}
                    </span>
                    <span>
                      {r.type === "DAILY"
                        ? r.dailyAssignments?.length || 0
                        : r.weeklyAssignments?.length || 0}{" "}
                      Staff
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRoster(r.id);
                  }}
                  className="absolute top-3 right-2 text-slate-300 hover:text-danger-ink opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN GRID AREA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-white dark:bg-slate-800 shadow-inner">
          <div className="max-w-6xl mx-auto space-y-6">
            {activeTab === "SETTINGS" && (
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 p-12 text-center space-y-6 shadow-sm">
                <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto text-accent-ink shadow-inner">
                  {currentType === "DAILY" ? <Clock size={40} /> : <Calendar size={40} />}
                </div>
                <div className="space-y-2">
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-2xl uppercase tracking-tight">
                    {currentType === "DAILY" ? "Daily Rotation" : "Weekly Rotation"}
                  </h3>
                  <p className="text-content-muted text-sm max-w-md mx-auto leading-relaxed">
                    {currentType === "DAILY"
                      ? "This mode schedules staff for each day of the week. The generator ensures staff appear only once in the 5-day cycle."
                      : `This mode schedules staff for a ${activeRoster.weeklyParams?.weeks || 0}-week block. The generator ensures staff are rotated fairly across all weeks.`}
                  </p>
                </div>
              </div>
            )}

            {activeTab === "ROSTER" && (
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/20 overflow-hidden flex flex-col">
                <div className="p-5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center px-8">
                  <div className="flex items-center gap-3">
                    <Layout size={18} className="text-accent-ink" />
                    <span className="text-[11px] font-black text-content-muted uppercase tracking-widest">
                      {rowCount} Rows • {slotCount} Columns
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/30 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-6 text-2xs font-black text-content-muted uppercase tracking-widest border-r bg-slate-50/50 dark:bg-slate-900/50 w-40 sticky left-0 z-10 backdrop-blur-md">
                          {currentType === "DAILY" ? "Day Index" : "Week Cycle"}
                        </th>
                        {Array.from({ length: slotCount }).map((_, i) => (
                          <th
                            key={i}
                            className="p-6 text-2xs font-black text-content-muted uppercase tracking-widest text-center min-w-[180px]"
                          >
                            Slot {i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rowLabels.map((label, rIdx) => (
                        <tr
                          key={label}
                          className="group hover:bg-slate-50/30 dark:bg-slate-900/30 transition-colors"
                        >
                          <td className="p-6 border-r whitespace-nowrap bg-slate-50/50 dark:bg-slate-900/50 sticky left-0 z-10 font-black text-slate-600 dark:text-slate-300 text-xs uppercase tracking-tighter">
                            {label}
                          </td>
                          {Array.from({ length: slotCount }).map((_, slotIdx) => {
                            const assignment = assignments.find(
                              (a) => a.day === rIdx && a.period === slotIdx,
                            );
                            const assignedTeacher = data.teachers.find(
                              (t) => t.id === assignment?.teacherId,
                            );
                            const isDropdownOpen =
                              openSlot?.row === rIdx && openSlot?.col === slotIdx;
                            const isSwapSource =
                              swapSource?.row === rIdx && swapSource?.col === slotIdx;

                            return (
                              <td
                                key={slotIdx}
                                className="p-4 border-r border-slate-50 last:border-r-0 h-28"
                              >
                                <div className="relative flex flex-col items-center justify-center h-full">
                                  {assignedTeacher ? (
                                    <div
                                      onClick={() =>
                                        isSwapMode && handleSwap(rIdx, slotIdx, assignedTeacher.id)
                                      }
                                      className={`w-full h-full flex flex-col justify-center border p-4 rounded-2xl transition-all shadow-sm ${
                                        isSwapSource
                                          ? "bg-amber-500 border-amber-600 text-white scale-105 z-20 shadow-xl rotate-1"
                                          : isSwapMode
                                            ? "bg-white dark:bg-slate-800 border-amber-200 cursor-pointer hover:border-amber-500 hover:shadow-md"
                                            : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300"
                                      }`}
                                    >
                                      <div className="flex justify-between items-start mb-1">
                                        <span
                                          className={`text-[11px] font-black uppercase tracking-tight ${isSwapSource ? "text-white" : "text-slate-800 dark:text-slate-100"}`}
                                        >
                                          {assignedTeacher.name}
                                        </span>
                                        {!isSwapMode && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleAssignment(rIdx, slotIdx, assignedTeacher.id);
                                            }}
                                            className="text-slate-300 hover:text-danger-ink transition-colors"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <div
                                          className={`w-1.5 h-1.5 rounded-full ${isSwapSource ? "bg-white dark:bg-slate-800 animate-pulse" : "bg-emerald-500"}`}
                                        />
                                        <span
                                          className={`text-2xs font-black uppercase tracking-widest ${isSwapSource ? "text-amber-50" : "text-content-muted"}`}
                                        >
                                          {isSwapSource ? "Swapping..." : "Active"}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative w-full h-full">
                                      <button
                                        onClick={() =>
                                          isSwapMode
                                            ? handleSwap(rIdx, slotIdx, "")
                                            : setOpenSlot({ row: rIdx, col: slotIdx })
                                        }
                                        className={`w-full h-full border-2 border-dashed rounded-2xl flex items-center justify-center transition-all ${
                                          isDropdownOpen
                                            ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-accent-ink"
                                            : isSwapMode
                                              ? "border-amber-100 bg-amber-50/20 text-amber-200"
                                              : "border-slate-100 dark:border-slate-700 text-slate-200 hover:border-slate-300 hover:text-slate-400 hover:bg-slate-50"
                                        }`}
                                      >
                                        <UserPlus size={24} />
                                      </button>

                                      {isDropdownOpen && !isSwapMode && (
                                        <>
                                          <div
                                            className="fixed inset-0 z-40 bg-transparent"
                                            onClick={() => setOpenSlot(null)}
                                          />
                                          <div className="absolute top-full left-0 z-50 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] shadow-2xl overflow-hidden mt-3 p-1 animate-in slide-in-from-top-2 duration-300">
                                            <div className="p-4 text-2xs font-black text-content-muted uppercase border-b bg-slate-50/50 dark:bg-slate-900/50 rounded-t-[1rem] sticky top-0 backdrop-blur-sm">
                                              Staff Selection
                                            </div>
                                            <div className="max-h-64 overflow-y-auto custom-scrollbar p-1 space-y-1">
                                              {data.teachers
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map((t) => {
                                                  const isAssignedThisCycle = assignments.some(
                                                    (a) => a.teacherId === t.id,
                                                  );
                                                  const isAssignedThisRow = assignments.some(
                                                    (a) => a.teacherId === t.id && a.day === rIdx,
                                                  );

                                                  return (
                                                    <button
                                                      key={t.id}
                                                      onClick={() =>
                                                        toggleAssignment(rIdx, slotIdx, t.id)
                                                      }
                                                      className={`w-full text-left px-3 py-3 text-[11px] font-bold flex justify-between items-center rounded-xl transition-all ${
                                                        isAssignedThisCycle
                                                          ? "bg-slate-50 dark:bg-slate-900 text-slate-300 opacity-60"
                                                          : "text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:bg-amber-900/30 hover:text-amber-800 dark:text-amber-200"
                                                      }`}
                                                    >
                                                      <span className="truncate">{t.name}</span>
                                                      {isAssignedThisRow && (
                                                        <span className="text-2xs font-black bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-2 py-1 rounded-lg uppercase">
                                                          Selected
                                                        </span>
                                                      )}
                                                      {isAssignedThisCycle &&
                                                        !isAssignedThisRow && (
                                                          <span className="text-2xs font-black bg-slate-100 dark:bg-slate-800 text-content-muted px-2 py-1 rounded-lg uppercase">
                                                            Other Row
                                                          </span>
                                                        )}
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
          weeks: activeRoster.weeklyParams?.weeks || 4,
        }}
        onGenerate={handleGenerateClick}
      />
    </div>
  );
};
