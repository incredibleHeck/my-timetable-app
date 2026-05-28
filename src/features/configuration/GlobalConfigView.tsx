import React, { useState } from "react";
import { Settings as SettingsIcon, Info } from "lucide-react";
import { AppData, ViewState } from "../../types";
import { Card, ConfirmDialog } from "../../components/ui";
import { useGlobalConfig } from "./hooks/useGlobalConfig";
import { useConfigCommit } from "./hooks/useConfigCommit";
import { useProfile } from "../../contexts/ProfileContext";
import { countScheduleSlotsAtOrAfterPeriod } from "./logic/configUtils";

import { ConfigPageHeader } from "./components/ConfigPageHeader";
import { ConfigImpactBanner } from "./components/ConfigImpactBanner";
import { SchoolIdentitySection } from "./components/SchoolIdentitySection";
import { TimelineAutomationSection } from "./components/TimelineAutomationSection";
import { RulesSection } from "./components/RulesSection";
import { ExamDefaultsSection } from "./components/ExamDefaultsSection";
import { ScheduleChainSection } from "./components/ScheduleChainSection";
import { ReservationsGridSection } from "./components/ReservationsGridSection";
import { SlotEditModal } from "./components/SlotEditModal";
import { DaySummaryStrip } from "./components/DaySummaryStrip";

type ConfigTab = "identity" | "structure" | "rules" | "reservations" | "exams";

const TABS: { id: ConfigTab; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "structure", label: "Day structure" },
  { id: "rules", label: "Rules" },
  { id: "reservations", label: "Fixed slots" },
  { id: "exams", label: "Exam defaults" },
];

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  profileName?: string;
  onNavigate?: (view: ViewState) => void;
}

export const GlobalConfigView: React.FC<ViewProps> = ({
  data,
  onUpdate,
  profileName,
  onNavigate,
}) => {
  const { activeProfile } = useProfile();
  const commit = useConfigCommit(data, onUpdate);
  const [activeTab, setActiveTab] = useState<ConfigTab>("structure");
  const [periodConfirm, setPeriodConfirm] = useState<{ val: number; dropped: number } | null>(null);

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
    recalculateAllSlotTimes,
    setPeriodType,
    handlePeriodCountChange,
    handleIdentityUpdate,
    updateTimeSlot,
    saveCustomLabel,
    updateMaxConsecutive,
    updateMaxSubjectPeriods,
    updateMaxTeacherPeriods,
    updateMaxTeachingPeriodsPerWeek,
    updateExamGrid,
    handleSlotClick,
    saveSlot,
  } = useGlobalConfig(data);

  const displayProfileName = profileName ?? activeProfile?.name;

  const handlePeriodSliderChange = (val: number) => {
    const current = data.settings.periodsPerDay;
    if (val < current) {
      const dropped = countScheduleSlotsAtOrAfterPeriod(data.schedule, val);
      if (dropped > 0) {
        setPeriodConfirm({ val, dropped });
        return;
      }
    }
    const nextData = handlePeriodCountChange(val);
    commit(`Updated daily period count to ${val}`, nextData);
  };

  const confirmPeriodReduction = () => {
    if (!periodConfirm) return;
    const nextData = handlePeriodCountChange(periodConfirm.val);
    commit(`Updated daily period count to ${periodConfirm.val}`, nextData);
    setPeriodConfirm(null);
  };

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6 animate-in fade-in duration-500 pb-12">
      <ConfigPageHeader profileName={displayProfileName} />
      <ConfigImpactBanner conflictCount={data.conflicts?.length ?? 0} onNavigate={onNavigate} />

      <div
        className="flex border-b border-slate-200 overflow-x-auto"
        role="tablist"
        aria-label="Configuration sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`config-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`config-panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-amber-500 text-amber-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "identity" && (
        <div role="tabpanel" id="config-panel-identity" aria-labelledby="config-tab-identity">
          <SchoolIdentitySection
            data={data}
            commit={commit}
            handleIdentityUpdate={handleIdentityUpdate}
          />
        </div>
      )}

      {activeTab === "structure" && (
        <div role="tabpanel" id="config-panel-structure" aria-labelledby="config-tab-structure">
          <Card className="p-8 border-t-4 border-t-amber-500">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <SettingsIcon className="mr-3 text-amber-500" size={24} aria-hidden />
              Timetable Structure
            </h3>

            <div className="flex items-start gap-2 p-3 mb-6 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-900">
              <Info size={16} className="shrink-0 mt-0.5" aria-hidden />
              <p>
                Individual classes can override period count and day structure in{" "}
                <strong>Classes</strong>.
              </p>
            </div>

            <TimelineAutomationSection
              data={data}
              commit={commit}
              handleDurationChange={handleDurationChange}
              recalculateAllSlotTimes={recalculateAllSlotTimes}
            />

            <div className="mb-10 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <label
                    htmlFor="periods-per-day"
                    className="block text-sm font-bold text-slate-700"
                  >
                    Total Daily Periods
                  </label>
                  <p className="text-xs text-slate-500">
                    Adjusting this will add or remove slots from the daily structure.
                  </p>
                </div>
                <span className="bg-slate-800 text-white font-bold px-4 py-1.5 rounded-lg text-sm shadow-sm">
                  {data.settings.periodsPerDay} Blocks
                </span>
              </div>
              <input
                id="periods-per-day"
                type="range"
                min="4"
                max="15"
                value={data.settings.periodsPerDay}
                onChange={(e) => handlePeriodSliderChange(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="mb-6">
              <ScheduleChainSection
                data={data}
                commit={commit}
                editingLabelIdx={editingLabelIdx}
                setEditingLabelIdx={setEditingLabelIdx}
                tempLabel={tempLabel}
                setTempLabel={setTempLabel}
                setPeriodType={setPeriodType}
                updateTimeSlot={updateTimeSlot}
                saveCustomLabel={saveCustomLabel}
              />
            </div>

            <DaySummaryStrip data={data} />
          </Card>
        </div>
      )}

      {activeTab === "rules" && (
        <div role="tabpanel" id="config-panel-rules" aria-labelledby="config-tab-rules">
          <Card className="p-8">
            <RulesSection
              data={data}
              commit={commit}
              updateMaxConsecutive={updateMaxConsecutive}
              updateMaxSubjectPeriods={updateMaxSubjectPeriods}
              updateMaxTeacherPeriods={updateMaxTeacherPeriods}
              updateMaxTeachingPeriodsPerWeek={updateMaxTeachingPeriodsPerWeek}
            />
          </Card>
        </div>
      )}

      {activeTab === "reservations" && (
        <div
          role="tabpanel"
          id="config-panel-reservations"
          aria-labelledby="config-tab-reservations"
        >
          <Card className="p-8">
            <ReservationsGridSection data={data} handleSlotClick={handleSlotClick} />
            <SlotEditModal
              editingSlot={editingSlot}
              setEditingSlot={setEditingSlot}
              applyToAllDays={applyToAllDays}
              setApplyToAllDays={setApplyToAllDays}
              saveSlot={(label) => {
                const nextData = saveSlot(label);
                if (nextData) {
                  commit(`Updated reservation: ${label || "Cleared"}`, nextData);
                }
              }}
            />
          </Card>
        </div>
      )}

      {activeTab === "exams" && (
        <div role="tabpanel" id="config-panel-exams" aria-labelledby="config-tab-exams">
          <Card className="p-8">
            <ExamDefaultsSection data={data} commit={commit} updateExamGrid={updateExamGrid} />
          </Card>
        </div>
      )}

      <ConfirmDialog
        isOpen={periodConfirm !== null}
        title="Reduce daily periods?"
        message={
          periodConfirm
            ? `Reducing to ${periodConfirm.val} periods will remove ${periodConfirm.dropped} assignment(s) in dropped period columns. Continue?`
            : ""
        }
        confirmLabel="Continue"
        variant="danger"
        onConfirm={confirmPeriodReduction}
        onCancel={() => setPeriodConfirm(null)}
      />
    </div>
  );
};
