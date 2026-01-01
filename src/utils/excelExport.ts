import ExcelJS from "exceljs";
import FileSaver from "file-saver";
import { AppData, ScheduleSlot } from "../types";
import { DAYS } from "./constants";

const { saveAs } = FileSaver;

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

  let maxPeriods = data.settings.periodsPerDay;
  if (mode === "CLASS") {
    const c = data.classes.find((x) => x.id === entityId);
    if (c && c.periodCount) maxPeriods = c.periodCount;
  }

  // HEADER ROW
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;

  const firstCell = headerRow.getCell(1);
  firstCell.value = "Day / Period";
  firstCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  firstCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  firstCell.alignment = { vertical: "middle", horizontal: "center" };

  for (let p = 0; p < maxPeriods; p++) {
    const cell = headerRow.getCell(p + 2);
    const timeSlot = data.settings.timeSlots[p] || {
      start: `${p + 1}`,
      end: "",
    };
    cell.value = `${timeSlot.start}\n${timeSlot.end}`;
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
    cell.border = { right: { style: "thin", color: { argb: "FF334155" } } };
    worksheet.getColumn(p + 2).width = 20;
  }
  worksheet.getColumn(1).width = 15;

  const merges: { r: number; c: number; c2: number }[] = [];

  for (let d = 0; d < 5; d++) {
    const row = worksheet.getRow(d + 2);
    row.height = 50;

    const dayCell = row.getCell(1);
    dayCell.value = DAYS[d];
    dayCell.font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
    dayCell.alignment = { vertical: "middle", horizontal: "center" };
    dayCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    dayCell.border = {
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "medium" },
    };

    for (let p = 0; p < maxPeriods; p++) {
      const cell = row.getCell(p + 2);
      const struct = data.settings.dayStructure[p];
      const isGlobalBreak = struct && struct.type !== "CLASS";

      let hasLesson = false;
      let isReserved = false;
      let isBlocked = false;
      let slot: ScheduleSlot | null = null;
      let cellColor = "";
      let cellText = "";
      let duration = 1;

      if (mode === "CLASS") {
        slot = data.schedule[entityId]?.[d]?.[p] ?? null;
        if (slot) {
          const prevSlot = p > 0 ? data.schedule[entityId]?.[d]?.[p - 1] : null;
          const isTail =
            slot.isFixed && prevSlot && prevSlot.subjectId === slot.subjectId;
          if (!isTail) {
            hasLesson = true;
            const subj = data.subjects.find((s) => s.id === slot!.subjectId);
            const tchr = data.teachers.find((t) => t.id === slot!.teacherId);
            cellText = `${subj?.name || "Subject"}\n${
              tchr?.name || "Unassigned"
            }`;
            cellColor = subj?.color || "#cbd5e1";
            duration = getDuration(data, entityId, d, p);
          }
        } else {
          const cls = data.classes.find((c) => c.id === entityId);
          const reserved =
            cls?.fixedSessions?.[d]?.[p] ||
            data.settings.fixedOccasions[d]?.[p];
          if (reserved) {
            cellText = typeof reserved === "string" ? reserved : "RESERVED";
            isReserved = true;
          }
        }
      } else {
        // TEACHER MODE
        let foundClass = null;
        let foundSlot: ScheduleSlot | null = null;
        for (const c of data.classes) {
          const s = data.schedule[c.id]?.[d]?.[p] ?? null;
          if (s && s.teacherId === entityId) {
            foundSlot = s;
            foundClass = c;
            break;
          }
        }
        if (foundSlot && foundClass) {
          const prevS =
            p > 0 ? data.schedule[foundClass.id]?.[d]?.[p - 1] ?? null : null;
          const isTail =
            foundSlot.isFixed &&
            prevS &&
            prevS.subjectId === foundSlot.subjectId;
          if (!isTail) {
            hasLesson = true;
            slot = foundSlot;
            const subj = data.subjects.find((s) => s.id === slot!.subjectId);
            cellText = `${foundClass.name}\n${subj?.name}`;
            cellColor = subj?.color || "#cbd5e1";
            duration = getDuration(data, foundClass.id, d, p);
          }
        } else {
          const t = data.teachers.find((x) => x.id === entityId);
          if (t?.constraints?.[d]?.[p]) {
            cellText = "BLOCKED";
            isBlocked = true;
          }
        }
      }

      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if (hasLesson) {
        cell.value = cellText;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: hexToArgb(cellColor) },
        };
        cell.font = {
          color: { argb: getContrastColor(cellColor) },
          bold: true,
        };
        if (duration === 2) merges.push({ r: d + 2, c: p + 2, c2: p + 3 });
      } else if (isReserved || isBlocked) {
        cell.value = cellText;
        cell.font = { bold: true, color: { argb: "FFFBBF24" }, size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1E293B" },
        };
      } else if (isGlobalBreak) {
        cell.value = struct.type === "LUNCH" ? "LUNCH" : "BREAK";
        cell.font = { bold: true, color: { argb: "FF94A3B8" }, size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    }
  }

  merges.forEach(({ r, c, c2 }) => {
    try {
      worksheet.mergeCells(r, c, r, c2);
    } catch (e) {}
  });
};

// --- MAIN EXPORT FUNCTION ---
export const exportScheduleToExcel = async (
  data: AppData,
  mode: "CLASS" | "TEACHER"
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduScheduler Pro";
  workbook.created = new Date();

  // BATCH EXPORT: Loop through ALL entities
  const entities = mode === "CLASS" ? data.classes : data.teachers;

  if (entities.length === 0) {
    alert(`No ${mode === "CLASS" ? "classes" : "teachers"} found to export.`);
    return;
  }

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
  saveAs(blob, fileName);
};
