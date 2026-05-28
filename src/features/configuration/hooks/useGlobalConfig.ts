import { useState, useCallback } from "react";
import { AppData, PeriodType, Settings } from "../../../types";
import { trimScheduleToPeriods } from "../logic/configUtils";

const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(":").map(Number);
  const totalMins = h * 60 + m + minutes;
  const newH = Math.floor(totalMins / 60) % 24;
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
};

export const useGlobalConfig = (data: AppData) => {
  const [editingSlot, setEditingSlot] = useState<{
    d: number;
    p: number;
    label: string;
  } | null>(null);
  const [applyToAllDays, setApplyToAllDays] = useState(false);
  const [editingLabelIdx, setEditingLabelIdx] = useState<number | null>(null);
  const [tempLabel, setTempLabel] = useState("");

  const recalculateTimeline = useCallback(
    (
      structure: Settings["dayStructure"],
      start: string,
      cDur: number,
      bDur: number,
      lDur: number,
    ) => {
      let currentTime = start;
      const newTimes: { start: string; end: string }[] = [];

      structure.forEach((block) => {
        let duration = cDur;
        if (block.type === "BREAK") duration = bDur;
        if (block.type === "LUNCH") duration = lDur;
        if (block.type === "ASSEMBLY") duration = cDur;

        const endTime = addMinutes(currentTime, duration);
        newTimes.push({ start: currentTime, end: endTime });
        currentTime = endTime;
      });

      return newTimes;
    },
    [],
  );

  const handleDurationChange = (field: keyof Settings, value: string | number): AppData => {
    const newSettings = { ...data.settings, [field]: value };

    const newTimes = recalculateTimeline(
      newSettings.dayStructure,
      newSettings.schoolStartTime || "08:00",
      newSettings.defaultClassDuration || 50,
      newSettings.defaultBreakDuration || 15,
      newSettings.defaultLunchDuration || 60,
    );

    return { ...data, settings: { ...newSettings, timeSlots: newTimes } };
  };

  const recalculateAllSlotTimes = (): AppData =>
    handleDurationChange("periodsPerDay", data.settings.periodsPerDay);

  const setPeriodType = (index: number, nextType: PeriodType): AppData => {
    const newStructure = [...data.settings.dayStructure];

    let newLabel = newStructure[index].label;
    if (nextType === "BREAK") newLabel = "Break";
    else if (nextType === "LUNCH") newLabel = "Lunch";
    else if (nextType === "ASSEMBLY") newLabel = "Assembly";
    else if (
      nextType === "CLASS" &&
      (newLabel === "Break" || newLabel === "Lunch" || newLabel === "Assembly")
    )
      newLabel = `Period ${index + 1}`;

    newStructure[index] = {
      ...newStructure[index],
      type: nextType,
      label: newLabel,
    };

    const newTimes = recalculateTimeline(
      newStructure,
      data.settings.schoolStartTime || "08:00",
      data.settings.defaultClassDuration || 50,
      data.settings.defaultBreakDuration || 15,
      data.settings.defaultLunchDuration || 60,
    );

    return {
      ...data,
      settings: {
        ...data.settings,
        dayStructure: newStructure,
        timeSlots: newTimes,
      },
    };
  };

  const handlePeriodCountChange = (val: number): AppData => {
    let newStructure = [...data.settings.dayStructure];
    const newFixed = data.settings.fixedOccasions.map((row) => {
      const safeRow = row || [];
      if (val > safeRow.length) return [...safeRow, ...Array(val - safeRow.length).fill(null)];
      return safeRow.slice(0, val);
    });

    if (val > newStructure.length) {
      for (let i = newStructure.length; i < val; i++)
        newStructure.push({ type: "CLASS", label: `Period ${i + 1}` });
    } else {
      newStructure = newStructure.slice(0, val);
    }

    const newTimes = recalculateTimeline(
      newStructure,
      data.settings.schoolStartTime || "08:00",
      data.settings.defaultClassDuration || 50,
      data.settings.defaultBreakDuration || 15,
      data.settings.defaultLunchDuration || 60,
    );

    const trimSchedule =
      val < data.settings.periodsPerDay ? trimScheduleToPeriods(data.schedule, val) : data.schedule;

    return {
      ...data,
      schedule: trimSchedule,
      settings: {
        ...data.settings,
        periodsPerDay: val,
        dayStructure: newStructure,
        fixedOccasions: newFixed,
        timeSlots: newTimes,
      },
    };
  };

  const handleIdentityUpdate = (field: "schoolName" | "academicYear", val: string): AppData => ({
    ...data,
    settings: { ...data.settings, [field]: val },
  });

  const updateTimeSlot = (idx: number, field: "start" | "end", value: string): AppData => {
    const newTimes = [...data.settings.timeSlots];
    while (newTimes.length <= idx) newTimes.push({ start: "00:00", end: "00:00" });
    newTimes[idx] = { ...newTimes[idx], [field]: value };
    return { ...data, settings: { ...data.settings, timeSlots: newTimes } };
  };

  const saveCustomLabel = (): AppData | undefined => {
    if (editingLabelIdx === null) return undefined;
    const newStructure = [...data.settings.dayStructure];
    newStructure[editingLabelIdx] = {
      ...newStructure[editingLabelIdx],
      label: tempLabel,
    };
    setEditingLabelIdx(null);
    return {
      ...data,
      settings: { ...data.settings, dayStructure: newStructure },
    };
  };

  const updateMaxConsecutive = (val: number): AppData => ({
    ...data,
    settings: { ...data.settings, maxConsecutivePeriods: val },
  });

  const updateMaxSubjectPeriods = (val: number): AppData => ({
    ...data,
    settings: { ...data.settings, maxSubjectPeriodsPerDay: val },
  });

  const updateMaxTeacherPeriods = (val: number): AppData => ({
    ...data,
    settings: { ...data.settings, maxTeacherPeriodsPerDay: val },
  });

  const updateMaxTeachingPeriodsPerWeek = (val: number): AppData => ({
    ...data,
    settings: { ...data.settings, maxTeachingPeriodsPerWeek: val },
  });

  const updateExamGrid = (patch: Partial<NonNullable<Settings["examGrid"]>>): AppData => ({
    ...data,
    settings: {
      ...data.settings,
      examGrid: { ...data.settings.examGrid, ...patch },
    },
  });

  const handleSlotClick = (d: number, p: number) => {
    let val: unknown = data.settings.fixedOccasions[d]?.[p];
    if (val === true) val = "Reserved";
    if (val === false || val === null) val = "";
    setEditingSlot({ d, p, label: val as string });
    setApplyToAllDays(false);
  };

  const saveSlot = (label: string): AppData | undefined => {
    if (!editingSlot) return undefined;
    const { d, p } = editingSlot;
    const newFixed = [...data.settings.fixedOccasions];

    if (applyToAllDays) {
      for (let i = 0; i < 5; i++) {
        if (!newFixed[i]) newFixed[i] = [];
        newFixed[i][p] = label;
      }
    } else {
      if (!newFixed[d]) newFixed[d] = [];
      newFixed[d][p] = label;
    }

    setEditingSlot(null);
    return {
      ...data,
      settings: { ...data.settings, fixedOccasions: newFixed },
    };
  };

  return {
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
  };
};
