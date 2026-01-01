import React from "react";
import {
  Settings as SettingsIcon,
  School,
  Coffee,
  Utensils,
  Clock,
  ShieldAlert,
  Check,
  GraduationCap,
  Calculator,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { AppData } from "../../types";
import { Button, Card, Modal, Input } from "../../components/ui";
import { DAYS } from "../../utils/constants";
import { useGlobalConfig } from "./hooks/useGlobalConfig";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const GlobalConfigView: React.FC<ViewProps> = ({ data, onUpdate }) => {
  const {
    editingSlot,
    setEditingSlot,
    applyToAllDays,
    setApplyToAllDays,
    editingLabelIdx,
    setEditingLabelIdx,
    tempLabel,
    setTempLabel,
    handleDurationChange,
    handleStructureChange,
    handlePeriodCountChange,
    handleIdentityUpdate,
    updateTimeSlot,
    saveCustomLabel,
    updateMaxConsecutive,
    handleSlotClick,
    saveSlot,
  } = useGlobalConfig(data, onUpdate);

  // Destructure for cleaner JSX
  const {
    schoolStartTime,
    defaultClassDuration: classDur,
    defaultBreakDuration: breakDur,
    defaultLunchDuration: lunchDur,
    maxConsecutivePeriods: maxConsecutive,
    timeSlots,
  } = data.settings;

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* 1. School Identity */}
      <Card className="p-6 border-l-4 border-l-slate-800 bg-white">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <GraduationCap className="text-slate-800" size={24} /> School
              Identity
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              This information will appear on all printed schedules and reports.
            </p>
          </div>
          <div className="flex gap-4 w-full md:w-auto flex-1 max-w-xl">
            <div className="flex-1">
              <Input
                label="Institution Name"
                placeholder="e.g. St. Mary's High School"
                value={data.settings.schoolName || ""}
                onChange={(e) =>
                  handleIdentityUpdate("schoolName", e.target.value)
                }
              />
            </div>
            <div className="w-40">
              <Input
                label="Academic Term"
                placeholder="e.g. 2024-2025"
                value={data.settings.academicYear || ""}
                onChange={(e) =>
                  handleIdentityUpdate("academicYear", e.target.value)
                }
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-8 border-t-4 border-t-amber-500">
        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center">
          <SettingsIcon className="mr-3 text-amber-500" size={28} /> Timetable
          Structure
        </h2>

        {/* --- SMART TIMELINE CONTROLS --- */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Calculator size={18} className="text-amber-600" />
            <h4 className="font-bold text-slate-700 text-sm">
              Smart Timeline Automation
            </h4>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Start of Day
              </label>
              <input
                type="time"
                value={schoolStartTime || "08:00"}
                onChange={(e) =>
                  handleDurationChange("schoolStartTime", e.target.value)
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Class (Mins)
              </label>
              <input
                type="number"
                min="10"
                max="120"
                value={classDur || 50}
                onChange={(e) =>
                  handleDurationChange(
                    "defaultClassDuration",
                    parseInt(e.target.value)
                  )
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Break (Mins)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                value={breakDur || 15}
                onChange={(e) =>
                  handleDurationChange(
                    "defaultBreakDuration",
                    parseInt(e.target.value)
                  )
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Lunch (Mins)
              </label>
              <input
                type="number"
                min="20"
                max="120"
                value={lunchDur || 60}
                onChange={(e) =>
                  handleDurationChange(
                    "defaultLunchDuration",
                    parseInt(e.target.value)
                  )
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:border-amber-500 outline-none"
              />
            </div>
            <div className="flex flex-col justify-end">
              <button
                onClick={() =>
                  handleDurationChange(
                    "periodsPerDay",
                    data.settings.periodsPerDay
                  )
                }
                className="flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold py-2.5 rounded-lg transition-colors"
                title="Force Recalculate"
              >
                <RotateCcw size={14} /> Reset Times
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 italic">
            <span className="font-bold text-amber-600">Tip:</span> Changing
            these numbers automatically recalculates all slot times below. You
            can still manually edit specific slots if needed.
          </p>
        </div>

        {/* Periods Slider */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-bold text-slate-700">
              Total Periods
            </label>
            <span className="bg-slate-800 text-white font-bold px-3 py-1 rounded text-sm">
              {data.settings.periodsPerDay} Blocks
            </span>
          </div>
          <input
            type="range"
            min="4"
            max="15"
            value={data.settings.periodsPerDay}
            onChange={(e) => handlePeriodCountChange(parseInt(e.target.value))}
            className="w-full accent-amber-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Day Structure & Times */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-end mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Interactive Schedule Chain
              </p>
            </div>

            <div className="space-y-2">
              {data.settings.dayStructure.map((period, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-lg hover:border-amber-400 transition-colors group"
                >
                  {/* Type Toggle */}
                  <div
                    onClick={() => handleStructureChange(idx)}
                    className={`
                                w-24 h-12 flex flex-col items-center justify-center rounded cursor-pointer border-2 font-bold text-xs select-none shadow-sm transition-transform active:scale-95
                                ${
                                  period.type === "CLASS"
                                    ? "bg-white border-slate-200 text-slate-700"
                                    : ""
                                }
                                ${
                                  period.type === "BREAK"
                                    ? "bg-amber-50 border-amber-300 text-amber-700"
                                    : ""
                                }
                                ${
                                  period.type === "LUNCH"
                                    ? "bg-orange-50 border-orange-300 text-orange-700"
                                    : ""
                                }
                            `}
                  >
                    {period.type === "CLASS" && <School size={16} />}
                    {period.type === "BREAK" && <Coffee size={16} />}
                    {period.type === "LUNCH" && <Utensils size={16} />}
                    <span className="mt-0.5">{period.type}</span>
                  </div>

                  {/* Label & Time Editor */}
                  <div className="flex-1 flex flex-col justify-center">
                    {/* Label Editor */}
                    <div className="flex items-center mb-1">
                      {editingLabelIdx === idx ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            className="text-xs font-bold text-slate-700 bg-slate-100 border border-amber-300 rounded px-1 py-0.5 w-full focus:outline-none"
                            value={tempLabel}
                            onChange={(e) => setTempLabel(e.target.value)}
                            autoFocus
                            onBlur={saveCustomLabel}
                            onKeyDown={(e) =>
                              e.key === "Enter" && saveCustomLabel()
                            }
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingLabelIdx(idx);
                            setTempLabel(period.label);
                          }}
                          className="text-xs font-bold text-slate-500 uppercase cursor-pointer hover:text-amber-600 flex items-center gap-2"
                        >
                          {period.label}
                        </div>
                      )}
                    </div>

                    {/* Time Inputs */}
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-700 focus:border-amber-500 outline-none"
                        value={timeSlots[idx]?.start || "00:00"}
                        onChange={(e) =>
                          updateTimeSlot(idx, "start", e.target.value)
                        }
                      />
                      <ArrowRight size={12} className="text-slate-300" />
                      <input
                        type="time"
                        className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-700 focus:border-amber-500 outline-none"
                        value={timeSlots[idx]?.end || "00:00"}
                        onChange={(e) =>
                          updateTimeSlot(idx, "end", e.target.value)
                        }
                      />
                      <span className="text-[9px] text-slate-400 ml-2">
                        (
                        {Math.round(
                          (new Date(
                            `1970-01-01T${timeSlots[idx]?.end}`
                          ).getTime() -
                            new Date(
                              `1970-01-01T${timeSlots[idx]?.start}`
                            ).getTime()) /
                            60000
                        )}
                        m)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Global Rules Sidebar */}
          <div>
            <div className="flex justify-between items-end mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Rules & Constraints
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-6 sticky top-4">
              {/* Fatigue Guard */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert size={18} className="text-amber-600" />
                  <h4 className="font-bold text-slate-700 text-sm">
                    Fatigue Guard
                  </h4>
                </div>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  Prevents burnout by ensuring teachers don't have more than{" "}
                  <strong>{maxConsecutive}</strong> classes in a row.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      updateMaxConsecutive(
                        Math.max(2, (maxConsecutive || 4) - 1)
                      )
                    }
                    className="w-8 h-8 rounded bg-white border border-slate-300 font-bold hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="text-lg font-bold text-slate-800 w-8 text-center">
                    {maxConsecutive || 4}
                  </span>
                  <button
                    onClick={() =>
                      updateMaxConsecutive(
                        Math.min(8, (maxConsecutive || 4) + 1)
                      )
                    }
                    className="w-8 h-8 rounded bg-white border border-slate-300 font-bold hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="h-px bg-slate-200 w-full"></div>

              {/* Stats */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={18} className="text-blue-600" />
                  <h4 className="font-bold text-slate-700 text-sm">Summary</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Day Starts</span>
                    <span className="font-bold text-slate-800">
                      {timeSlots[0]?.start}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Day Ends</span>
                    <span className="font-bold text-slate-800">
                      {timeSlots[timeSlots.length - 1]?.end}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Reservations Grid */}
        <div className="mt-10">
          <div className="flex justify-between items-end mb-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Global Reservations (Fixed Slots)
            </p>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl p-4 bg-slate-50 shadow-inner">
            <div
              className="grid gap-1 min-w-[800px]"
              style={{
                gridTemplateColumns: `80px repeat(${data.settings.periodsPerDay}, 1fr)`,
              }}
            >
              <div className="text-xs font-bold text-slate-400 uppercase text-right pr-3 py-1 self-end">
                Day
              </div>
              {data.settings.dayStructure.map((p, i) => (
                <div key={i} className="text-center">
                  <div className="text-[10px] font-bold text-slate-400 mb-1">
                    P{i + 1}
                  </div>
                </div>
              ))}

              {DAYS.map((day, dIdx) => (
                <React.Fragment key={day}>
                  <div className="text-xs font-bold text-slate-700 text-right pr-4 py-3 self-center uppercase tracking-wider">
                    {day.substring(0, 3)}
                  </div>
                  {Array.from({ length: data.settings.periodsPerDay }).map(
                    (_, pIdx) => {
                      let occasionName: any =
                        data.settings.fixedOccasions[dIdx]?.[pIdx];
                      if (occasionName === true) occasionName = "Reserved";
                      return (
                        <button
                          key={`${dIdx}-${pIdx}`}
                          onClick={() => handleSlotClick(dIdx, pIdx)}
                          className={`
                           h-12 rounded-md transition-all duration-200 border flex flex-col items-center justify-center px-1 text-[10px] leading-tight overflow-hidden break-words relative group
                           ${
                             occasionName
                               ? "bg-slate-800 border-slate-900 shadow-inner text-amber-400 font-bold"
                               : "bg-white border-slate-200 hover:border-amber-400 hover:shadow-md text-slate-300"
                           }
                         `}
                        >
                          {occasionName ? (
                            <span className="z-10 text-center">
                              {occasionName}
                            </span>
                          ) : (
                            <span className="opacity-0 group-hover:opacity-100 font-bold">
                              +
                            </span>
                          )}
                        </button>
                      );
                    }
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* SLOT EDIT MODAL */}
        <Modal
          isOpen={!!editingSlot}
          onClose={() => setEditingSlot(null)}
          title="Configure Global Event"
          footer={
            <div className="flex justify-between w-full">
              <Button variant="danger" onClick={() => saveSlot("")}>
                Clear Slot
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setEditingSlot(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveSlot(editingSlot?.label || "Reserved")}
                >
                  Save Event
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            <Input
              label="Event Name"
              value={editingSlot?.label || ""}
              onChange={(e) =>
                setEditingSlot((prev) =>
                  prev ? { ...prev, label: e.target.value } : null
                )
              }
              placeholder="e.g. Morning Assembly, Staff Meeting"
              autoFocus
            />
            <div
              className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                applyToAllDays
                  ? "bg-amber-50 border-amber-300"
                  : "bg-white border-slate-200 hover:bg-slate-50"
              }`}
              onClick={() => setApplyToAllDays(!applyToAllDays)}
            >
              <div
                className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${
                  applyToAllDays
                    ? "bg-amber-500 border-amber-500"
                    : "bg-white border-slate-300"
                }`}
              >
                {applyToAllDays && <Check size={14} className="text-white" />}
              </div>
              <div>
                <p
                  className={`text-sm font-bold ${
                    applyToAllDays ? "text-amber-800" : "text-slate-700"
                  }`}
                >
                  Apply to all days
                </p>
                <p className="text-xs text-slate-500">
                  Block this period for Monday–Friday.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      </Card>
    </div>
  );
};
