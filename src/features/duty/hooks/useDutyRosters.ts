import { useState, useMemo, useEffect } from "react";
import { AppData, DutyRoster } from "../../../types";
import { generateId } from "../../../utils/utils";
import { migrateDutyRoster } from "../logic/legacyRoster";

export const useDutyRosters = (data: AppData, onUpdate: (newData: AppData) => void) => {
  const [activeRosterId, setActiveRosterId] = useState<string | null>(null);

  useEffect(() => {
    let updated = false;
    let rosters = [...(data.dutyRosters || [])];

    const legacyAssignments = data.dutyAssignments ?? [];
    if (legacyAssignments.length > 0 && rosters.length === 0) {
      const legacyRoster: DutyRoster = {
        id: generateId(),
        name: "Imported Roster",
        type: "DAILY",
        dailyAssignments: legacyAssignments,
        weeklyAssignments: [],
        dailyParams: { min: 4, max: 6 },
        weeklyParams: { min: 4, max: 6, weeks: 4 },
        createdAt: new Date().toISOString(),
      };
      rosters = [legacyRoster];
      updated = true;
    }

    const migratedRosters = rosters.map((roster) => migrateDutyRoster(roster));
    if (JSON.stringify(migratedRosters) !== JSON.stringify(rosters)) {
      rosters = migratedRosters;
      updated = true;
    }

    if (rosters.length === 0) {
      const defaultRoster: DutyRoster = {
        id: generateId(),
        name: "Standard Duty Roster",
        type: "DAILY",
        dailyAssignments: [],
        weeklyAssignments: [],
        dailyParams: { min: 4, max: 6 },
        weeklyParams: { min: 4, max: 6, weeks: 4 },
        createdAt: new Date().toISOString(),
      };
      rosters = [defaultRoster];
      updated = true;
    }

    if (updated) {
      onUpdate({
        ...data,
        dutyRosters: rosters,
        dutyAssignments: [],
      });
    }

    if (!activeRosterId && rosters.length > 0) {
      setActiveRosterId(rosters[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.dutyRosters, data.dutyAssignments]);

  const activeRoster = useMemo(() => {
    if (!data.dutyRosters || data.dutyRosters.length === 0) return null;
    return data.dutyRosters.find((r) => r.id === activeRosterId) || data.dutyRosters[0];
  }, [data.dutyRosters, activeRosterId]);

  const updateActiveRoster = (updates: Partial<DutyRoster>) => {
    if (!activeRoster) return;
    const newRosters = data.dutyRosters?.map((r) =>
      r.id === activeRoster.id ? { ...r, ...updates } : r,
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
      createdAt: new Date().toISOString(),
    };
    onUpdate({ ...data, dutyRosters: [...(data.dutyRosters || []), newRoster] });
    setActiveRosterId(newRoster.id);
  };

  const deleteRoster = (id: string) => {
    if (!confirm("Are you sure you want to delete this roster?")) return;
    const filtered = data.dutyRosters?.filter((r) => r.id !== id) || [];
    onUpdate({ ...data, dutyRosters: filtered });
    if (activeRosterId === id) {
      setActiveRosterId(filtered[0]?.id || null);
    }
  };

  return {
    activeRosterId,
    setActiveRosterId,
    activeRoster,
    updateActiveRoster,
    createNewRoster,
    deleteRoster,
  };
};
