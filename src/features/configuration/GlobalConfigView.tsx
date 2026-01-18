import React from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { AppData } from "../../types";
import { Card } from "../../components/ui";
import { useGlobalConfig } from "./hooks/useGlobalConfig";
import { useProfile } from "../../contexts/ProfileContext";

// Modular Components
import { SchoolIdentitySection } from "./components/SchoolIdentitySection";
import { TimelineAutomationSection } from "./components/TimelineAutomationSection";
import { RulesSection } from "./components/RulesSection";
import { ScheduleChainSection } from "./components/ScheduleChainSection";
import { ReservationsGridSection } from "./components/ReservationsGridSection";
import { SlotEditModal } from "./components/SlotEditModal";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const GlobalConfigView: React.FC<ViewProps> = ({ data, onUpdate }) => {
  const { addActivity } = useProfile();
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
    updateTimeSlot,
    saveCustomLabel,
    handleSlotClick,
    saveSlot,
  } = useGlobalConfig(data, onUpdate);

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* 1. School Identity Section */}
      <SchoolIdentitySection data={data} onUpdate={onUpdate} addActivity={addActivity} />

      <Card className="p-8 border-t-4 border-t-amber-500">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
          <SettingsIcon className="mr-3 text-amber-500" size={28} /> Timetable Structure
        </h2>

        {/* 2. Timeline Automation Section */}
        <TimelineAutomationSection
          data={data}
          onUpdate={onUpdate}
          addActivity={addActivity}
          handleDurationChange={handleDurationChange}
        />

        {/* 3. Periods Slider */}
        <div className="mb-10 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <label className="block text-sm font-bold text-slate-700">Total Daily Periods</label>
              <p className="text-xs text-slate-500">
                Adjusting this will add or remove slots from the daily structure.
              </p>
            </div>
            <span className="bg-slate-800 text-white font-bold px-4 py-1.5 rounded-lg text-sm shadow-sm">
              {data.settings.periodsPerDay} Blocks
            </span>
          </div>
          <input
            type="range"
            min="4"
            max="15"
            value={data.settings.periodsPerDay}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              const nextData = { ...data, settings: { ...data.settings, periodsPerDay: val } };
              addActivity("SYSTEM", `Updated daily period count to ${val}`, nextData);
              onUpdate(nextData);
            }}
            className="w-full accent-amber-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* 4. Interactive Schedule Chain (Horizontal Row) */}
        <div className="mb-10">
          <ScheduleChainSection
            data={data}
            editingLabelIdx={editingLabelIdx}
            setEditingLabelIdx={setEditingLabelIdx}
            tempLabel={tempLabel}
            setTempLabel={setTempLabel}
            handleStructureChange={handleStructureChange}
            updateTimeSlot={updateTimeSlot}
            saveCustomLabel={saveCustomLabel}
          />
        </div>

        {/* 5. Rules & Constraints Section (Full Width) */}
        <div className="mb-10">
          <RulesSection data={data} onUpdate={onUpdate} addActivity={addActivity} />
        </div>

        {/* 6. Global Reservations Grid */}
        <ReservationsGridSection data={data} handleSlotClick={handleSlotClick} />

        {/* Slot Edit Modal */}
        <SlotEditModal
          editingSlot={editingSlot}
          setEditingSlot={setEditingSlot}
          applyToAllDays={applyToAllDays}
          setApplyToAllDays={setApplyToAllDays}
          saveSlot={saveSlot}
        />
      </Card>
    </div>
  );
};