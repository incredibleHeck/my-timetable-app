import React, { useState } from "react";
import { AppData, ViewState } from "../../types";
import { ConfirmDialog, NumberStepper } from "../../components/ui";
import { useGlobalConfig } from "./hooks/useGlobalConfig";
import { useConfigCommit } from "./hooks/useConfigCommit";
import { useProfile } from "../../contexts/ProfileContext";
import { countScheduleSlotsAtOrAfterPeriod } from "./logic/configUtils";
import { getOccasionLabel } from "../../utils/utils";

import { ConfigPageHeader } from "./components/ConfigPageHeader";
import { ConfigImpactBanner } from "./components/ConfigImpactBanner";
import { ConfigNav, ConfigSection } from "./components/ConfigNav";
import { ConfigPanel, PanelRegion } from "./components/ConfigPanel";
import { SchoolIdentitySection } from "./components/SchoolIdentitySection";
import { BellScheduleSection } from "./components/BellScheduleSection";
import { RulesSection } from "./components/RulesSection";
import { ExamDefaultsSection } from "./components/ExamDefaultsSection";
import { PeriodListSection } from "./components/PeriodListSection";
import { ReservationsGridSection } from "./components/ReservationsGridSection";
import { SlotEditModal } from "./components/SlotEditModal";
import { DayTimeline } from "./components/DayTimeline";

type ConfigTab = "identity" | "structure" | "rules" | "reservations" | "exams";

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
    handleDurationChange,
    recalculateAllSlotTimes,
    setPeriodType,
    setPeriodLabel,
    handlePeriodCountChange,
    handleIdentityUpdate,
    updateTimeSlot,
    updateMaxConsecutive,
    updateMaxSubjectPeriods,
    updateMaxTeacherPeriods,
    updateMaxTeachingPeriodsPerWeek,
    updateExamGrid,
    updateSolverTimeout,
    handleSlotClick,
    saveSlot,
  } = useGlobalConfig(data);

  const displayProfileName = profileName ?? activeProfile?.name;
  const { periodsPerDay, fixedOccasions, examGrid } = data.settings;

  const reservedCount = fixedOccasions.reduce(
    (total, day) => total + (day || []).filter((slot) => getOccasionLabel(slot)).length,
    0,
  );

  const sections: ConfigSection<ConfigTab>[] = [
    { id: "identity", label: "School identity" },
    { id: "structure", label: "Day structure", meta: `${periodsPerDay} periods` },
    { id: "rules", label: "Scheduling rules" },
    {
      id: "reservations",
      label: "Reserved slots",
      meta: reservedCount > 0 ? String(reservedCount) : undefined,
    },
    { id: "exams", label: "Exam defaults", meta: `${examGrid?.sessionsPerDay ?? 2}/day` },
  ];

  const applyPeriodCount = (val: number) => {
    if (val < periodsPerDay) {
      const dropped = countScheduleSlotsAtOrAfterPeriod(data.schedule, val);
      if (dropped > 0) {
        setPeriodConfirm({ val, dropped });
        return;
      }
    }
    commit(`Updated daily period count to ${val}`, handlePeriodCountChange(val));
  };

  const confirmPeriodReduction = () => {
    if (!periodConfirm) return;
    commit(
      `Updated daily period count to ${periodConfirm.val}`,
      handlePeriodCountChange(periodConfirm.val),
    );
    setPeriodConfirm(null);
  };

  const panelProps = (id: ConfigTab) => ({
    role: "tabpanel",
    id: `config-panel-${id}`,
    "aria-labelledby": `config-tab-${id}`,
    tabIndex: 0,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6 pb-16 md:p-8">
      <ConfigPageHeader profileName={displayProfileName} />
      <ConfigImpactBanner conflictCount={data.conflicts?.length ?? 0} onNavigate={onNavigate} />

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <ConfigNav sections={sections} activeId={activeTab} onSelect={setActiveTab} />

        <div className="min-w-0">
          {activeTab === "identity" && (
            <div {...panelProps("identity")}>
              <SchoolIdentitySection
                data={data}
                commit={commit}
                handleIdentityUpdate={handleIdentityUpdate}
              />
            </div>
          )}

          {activeTab === "structure" && (
            <div {...panelProps("structure")} className="space-y-4">
              <BellScheduleSection
                data={data}
                commit={commit}
                handleDurationChange={handleDurationChange}
                recalculateAllSlotTimes={recalculateAllSlotTimes}
              />

              <ConfigPanel
                title="Periods"
                description="The shape of a single day, repeated Monday to Friday. Individual classes can override this in Classes."
                action={
                  <NumberStepper
                    id="periods-per-day"
                    label="Periods per day"
                    value={periodsPerDay}
                    min={4}
                    max={15}
                    unit="per day"
                    onChange={applyPeriodCount}
                  />
                }
              >
                <PanelRegion>
                  <DayTimeline data={data} />
                </PanelRegion>
                <PanelRegion>
                  <PeriodListSection
                    data={data}
                    commit={commit}
                    setPeriodType={setPeriodType}
                    setPeriodLabel={setPeriodLabel}
                    updateTimeSlot={updateTimeSlot}
                  />
                </PanelRegion>
              </ConfigPanel>
            </div>
          )}

          {activeTab === "rules" && (
            <div {...panelProps("rules")}>
              <RulesSection
                data={data}
                commit={commit}
                updateMaxConsecutive={updateMaxConsecutive}
                updateMaxSubjectPeriods={updateMaxSubjectPeriods}
                updateMaxTeacherPeriods={updateMaxTeacherPeriods}
                updateMaxTeachingPeriodsPerWeek={updateMaxTeachingPeriodsPerWeek}
                updateSolverTimeout={updateSolverTimeout}
              />
            </div>
          )}

          {activeTab === "reservations" && (
            <div {...panelProps("reservations")}>
              <ConfigPanel
                title="Reserved slots"
                description="Periods blocked for every class — assemblies, staff meetings, chapel. The generator leaves them empty."
                action={
                  <span className="text-xs tabular-nums text-content-muted">
                    {reservedCount} reserved
                  </span>
                }
              >
                <PanelRegion>
                  <ReservationsGridSection data={data} handleSlotClick={handleSlotClick} />
                </PanelRegion>
              </ConfigPanel>
              <SlotEditModal
                editingSlot={editingSlot}
                setEditingSlot={setEditingSlot}
                applyToAllDays={applyToAllDays}
                setApplyToAllDays={setApplyToAllDays}
                saveSlot={(label) => {
                  const nextData = saveSlot(label);
                  if (nextData) {
                    commit(label ? `Reserved slot: ${label}` : "Cleared reserved slot", nextData);
                  }
                }}
              />
            </div>
          )}

          {activeTab === "exams" && (
            <div {...panelProps("exams")}>
              <ExamDefaultsSection data={data} commit={commit} updateExamGrid={updateExamGrid} />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={periodConfirm !== null}
        title="Reduce daily periods?"
        message={
          periodConfirm
            ? `Reducing to ${periodConfirm.val} periods removes ${periodConfirm.dropped} assignment${
                periodConfirm.dropped === 1 ? "" : "s"
              } from the periods being dropped. This can be undone.`
            : ""
        }
        confirmLabel="Reduce periods"
        variant="danger"
        onConfirm={confirmPeriodReduction}
        onCancel={() => setPeriodConfirm(null)}
      />
    </div>
  );
};
