import type ExcelJS from "exceljs";
import { AppData, ScheduleSlot } from "../../types";
import { DAYS } from "../../utils/constants";
import { FileService } from "../fileSystem";
import { calculateClassSchedule, getFormattedTimeRange } from "../../utils/timeUtils";
import { getOccasionLabel } from "../../utils/utils";
import { notify } from "../../components/ui/Toast";
import { loadExcelJS } from "./excelLoader";

// --- HELPERS ---
const hexToArgb = (hex?: string) => {
  if (!hex) return "FFFFFFFF";
  const cleanHex = hex.replace("#", "");
  return `FF${cleanHex}`;
};

const getContrastColor = (hex?: string) => {
  if (!hex) return "FF000000";
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "FF000000" : "FFFFFFFF";
};

const getDuration = (
  data: AppData,
  classId: string,
  d: number,
  p: number
): number => {
  const slot = data.schedule[classId]?.[d]?.[p];
  if (!slot) return 1;
  const nextSlot = data.schedule[classId]?.[d]?.[p + 1];
  if (nextSlot && nextSlot.isFixed && nextSlot.subjectId === slot.subjectId) {
    return 2;
  }
  return 1;
};

// --- HELPER: GENERATE SINGLE SHEET ---
const generateSheet = (
  workbook: ExcelJS.Workbook,
  data: AppData,
  entityId: string,
  entityName: string,
  mode: "CLASS" | "TEACHER"
) => {
  // sanitize name for Excel sheet limit (31 chars) and invalid chars
  const safeName = entityName.replace(/[\\/?*[\]]/g, "").substring(0, 30);
  const worksheet = workbook.addWorksheet(safeName);

  // --- PAGE SETUP FOR A4 LANDSCAPE ---
  worksheet.pageSetup = {
    paperSize: 9, // A4
    orientation: "landscape",
    fitToPage: true,
    fitToHeight: 1,
    fitToWidth: 1,
    margins: {
      left: 0.5, right: 0.5,
      top: 0.5, bottom: 0.5,
      header: 0.3, footer: 0.3
    }
  };

  const { settings, schedule, classes, teachers, subjects } = data;
  const currentClass = classes.find((c) => c.id === entityId);
  
  // Dynamic Structure
  const currentStructure = (mode === "CLASS" && currentClass?.structure?.length)
    ? currentClass.structure
    : settings.dayStructure;

  // Pre-calculate class schedule for times
  const classSchedule = (mode === "CLASS" && currentClass) 
    ? calculateClassSchedule(currentClass, settings, currentStructure)
    : [];

  // Periods calculation
  let maxPeriods = settings.periodsPerDay;
  if (mode === "CLASS" && currentClass) {
      maxPeriods = currentClass.structure?.length || currentClass.periodCount || settings.periodsPerDay;
  }

  // Helper for sequential numbering
  const getLabel = (index: number) => {
    const item = currentStructure?.[index];
    const type = typeof item === "string" ? item : item?.type;
    const effectiveType = type || "CLASS"; 

    if (effectiveType !== "CLASS") {
        const label = typeof item === "string" ? item : item?.label || item?.type;
        return label?.toUpperCase() || "BREAK";
    }

    let classCount = 0;
    for (let i = 0; i <= index; i++) {
        const pItem = currentStructure?.[i];
        const pType = typeof pItem === "string" ? pItem : pItem?.type;
        if ((pType || "CLASS") === "CLASS") classCount++;
    }
    return `PERIOD ${classCount}`;
  };

  // TITLE ROW
  const titleRow = worksheet.getRow(1);
  titleRow.height = 40;
  const titleCell = titleRow.getCell(1);
  titleCell.value = `${settings.schoolName || "Timetable"} - ${mode === "CLASS" ? "Class" : "Teacher"}: ${entityName}`;
  titleCell.font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.mergeCells(1, 1, 1, maxPeriods + 1);

  // HEADER ROW
  const headerRow = worksheet.getRow(2);
  headerRow.height = 35;

  const firstCell = headerRow.getCell(1);
  firstCell.value = "DAY / PERIOD";
  firstCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  firstCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  firstCell.alignment = { vertical: "middle", horizontal: "center" };
  firstCell.border = { 
    right: { style: "medium", color: { argb: "FFFFFFFF" } },
    bottom: { style: "medium", color: { argb: "FF0F172A" } }
  };

  for (let p = 0; p < maxPeriods; p++) {
    const cell = headerRow.getCell(p + 2);
    const label = getLabel(p);
    let timeSlot = settings.timeSlots[p];
    
    if (mode === "CLASS" && classSchedule[p]) {
        timeSlot = classSchedule[p];
    }
    
    const timeLabel = getFormattedTimeRange(timeSlot);
    cell.value = timeLabel ? `${label}\n${timeLabel}` : label;
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334155" },
    };
    cell.border = { 
        right: { style: "thin", color: { argb: "FF475569" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } }
    };
    worksheet.getColumn(p + 2).width = 22;
  }
  worksheet.getColumn(1).width = 18;

  const merges: { r: number; c: number; c2: number }[] = [];

  for (let d = 0; d < 5; d++) {
    const row = worksheet.getRow(d + 3);
    row.height = 65;

    const dayCell = row.getCell(1);
    dayCell.value = DAYS[d];
    dayCell.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
    dayCell.alignment = { vertical: "middle", horizontal: "center" };
    dayCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    dayCell.border = {
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "medium", color: { argb: "FF0F172A" } },
    };

    for (let p = 0; p < maxPeriods; p++) {
      const cell = row.getCell(p + 2);
      const struct = currentStructure?.[p];
      const isBreak = struct && (typeof struct === "string" ? struct : struct.type) !== "CLASS";

      let isReserved = false;
      let isBlocked = false;
      let hasLesson = false;
      let slot: ScheduleSlot | null = null;
      let cellColor = "";
      let cellText = "";
      let duration = 1;
      let isSpecialSubject = false;

      if (mode === "CLASS") {
        slot = schedule[entityId]?.[d]?.[p] ?? null;
        if (slot) {
          const prevSlot = p > 0 ? schedule[entityId]?.[d]?.[p - 1] : null;
          const isTail = slot.isFixed && prevSlot && prevSlot.subjectId === slot.subjectId;
          if (!isTail) {
            hasLesson = true;
            const subj = subjects.find((s) => s.id === slot!.subjectId);
            const tchr = teachers.find((t) => t.id === slot!.teacherId);
            cellText = `${subj?.name || "Subject"}\n${tchr?.name || "Unassigned"}`;
            cellColor = subj?.color || "#cbd5e1";
            duration = getDuration(data, entityId, d, p);
            
            // Special Subject Styling (Worship, Assembly, etc.)
            const subLower = (subj?.name || "").toLowerCase();
            if (slot.locked || subLower.includes("worship") || subLower.includes("assembly") || subLower.includes("club") || subLower.includes("meeting")) {
                isSpecialSubject = true;
            }
          }
        } else {
            // Check Class & Global Fixed Sessions
            const reserved = currentClass?.fixedSessions?.[d]?.[p] || settings.fixedOccasions?.[d]?.[p];
            const reservedLabel = getOccasionLabel(reserved);
            if (reservedLabel) {
                cellText = reservedLabel;
                isReserved = true;
            }
        }
      } else {
        // TEACHER MODE
        let foundClass = null;
        let foundSlot: ScheduleSlot | null = null;
        for (const c of classes) {
          const s = schedule[c.id]?.[d]?.[p] ?? null;
          if (s && s.teacherId === entityId) {
            foundSlot = s;
            foundClass = c;
            break;
          }
        }
        if (foundSlot && foundClass) {
          const prevS = p > 0 ? schedule[foundClass.id]?.[d]?.[p - 1] ?? null : null;
          const isTail = foundSlot.isFixed && prevS && prevS.subjectId === foundSlot.subjectId;
          if (!isTail) {
            hasLesson = true;
            slot = foundSlot;
            const subj = subjects.find((s) => s.id === slot!.subjectId);
            cellText = `${foundClass.name}\n${subj?.name}`;
            cellColor = subj?.color || "#cbd5e1";
            duration = getDuration(data, foundClass.id, d, p);

            const subLower = (subj?.name || "").toLowerCase();
            if (slot.locked || subLower.includes("worship") || subLower.includes("assembly") || subLower.includes("club") || subLower.includes("meeting")) {
                isSpecialSubject = true;
            }
          }
        } else {
          const t = teachers.find((x) => x.id === entityId);
          if (t?.constraints?.[d]?.[p]) {
            cellText = "BLOCKED";
            isBlocked = true;
          }
        }
      }

      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };

      if (hasLesson) {
        cell.value = cellText;
        if (isSpecialSubject) {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF0F172A" },
            };
            cell.font = { color: { argb: "FFFBBF24" }, bold: true, size: 10 };
        } else {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: hexToArgb(cellColor) },
            };
            cell.font = {
                color: { argb: getContrastColor(cellColor) },
                bold: true,
                size: 10
            };
        }
        if (duration === 2) merges.push({ r: d + 3, c: p + 2, c2: p + 3 });
      } else if (isReserved || isBlocked) {
        cell.value = cellText;
        cell.font = { bold: true, color: { argb: "FFFBBF24" }, size: 9 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1E293B" },
        };
      } else if (isBreak) {
        const breakType = (typeof struct === "string" ? struct : struct?.type) || "BREAK";
        cell.value = breakType.toUpperCase();
        cell.font = { bold: true, color: { argb: "FF64748B" }, size: 9 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    }
  }

  merges.forEach(({ r, c, c2 }) => {
    try { worksheet.mergeCells(r, c, r, c2); } catch (e) {}
  });
};

// --- MAIN EXPORT FUNCTION ---
export const exportScheduleToExcel = async (
  data: AppData,
  mode: "CLASS" | "TEACHER"
) => {
  const entities = mode === "CLASS" ? data.classes : data.teachers;

  if (entities.length === 0) {
    notify(
      `No ${mode === "CLASS" ? "classes" : "teachers"} found to export.`,
      "error",
    );
    return;
  }

  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduScheduler Pro";
  workbook.created = new Date();

  // Create a sheet for every single entity
  entities.forEach((entity) => {
    generateSheet(workbook, data, entity.id, entity.name, mode);
  });

  // Save File
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `Full_${
    mode === "CLASS" ? "Classes" : "Faculty"
  }_Schedule.xlsx`;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  
  await FileService.saveExport(blob, fileName, "xlsx");
};
