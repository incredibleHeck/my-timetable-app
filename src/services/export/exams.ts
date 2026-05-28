import type ExcelJS from "exceljs";
import { AppData, ExamSession } from "../../types";
import {
  getStreamLevel,
  getClassDayInvigilationTeam,
} from "../../features/exams/logic/examUtils";
import { FileService } from "../fileSystem";
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

const formatDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};

// --- EXCEL EXPORT ---
export const exportExamsToExcel = async (data: AppData) => {
  const { exams, subjects, classes, settings } = data;
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduScheduler Pro";
  workbook.created = new Date();

  const levelGroups: Record<string, { ids: string[]; names: string[] }> = {};
  classes.forEach((cls) => {
    const lvl = getStreamLevel(cls.id, classes);
    if (!levelGroups[lvl]) levelGroups[lvl] = { ids: [], names: [] };
    levelGroups[lvl].ids.push(cls.id);
    levelGroups[lvl].names.push(cls.name);
  });

  const sortedLevels = Object.keys(levelGroups).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  // 1. GENERATE SHEETS PER LEVEL
  sortedLevels.forEach((level) => {
    const group = levelGroups[level];
    // Find all exams belonging to ANY class in this level
    const allLevelExams = exams.filter((e) =>
      e.classIds.some((cid) => group.ids.includes(cid))
    );

    if (allLevelExams.length === 0) return;

    // DEDUPLICATE: Multi-stream classes write the same exams.
    // We only want to show each unique Subject+Paper+Time once per cohort sheet.
    const levelExams: ExamSession[] = [];
    const seen = new Set<string>();
    allLevelExams.forEach((e) => {
      const key = `${e.subjectId}-${e.paperNumber}-${e.date}-${e.startTime}`;
      if (!seen.has(key)) {
        levelExams.push(e);
        seen.add(key);
      }
    });

    const classDisplayName = group.names.join(" & ");
    const sheetName = classDisplayName.substring(0, 30);
    const sheet = workbook.addWorksheet(sheetName);

    // Page Setup for A4
    sheet.pageSetup = {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToHeight: 1,
      fitToWidth: 1,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    };

    // Define Columns
    sheet.columns = [
      { key: "date", width: 20 },
      { key: "s1", width: 40 },
      { key: "s2", width: 40 },
    ];

    // --- HEADERS ---
    // School Name
    const schoolRow = sheet.getRow(1);
    schoolRow.height = 35;
    sheet.mergeCells(1, 1, 1, 3);
    const schoolCell = schoolRow.getCell(1);
    schoolCell.value =
      settings.schoolName?.toUpperCase() || "SCHOOL EXAM TIMETABLE";
    schoolCell.font = { bold: true, size: 20, color: { argb: "FF0F172A" } };
    schoolCell.alignment = { horizontal: "center", vertical: "middle" };

    // Level Header
    const levelRow = sheet.getRow(2);
    levelRow.height = 25;
    sheet.mergeCells(2, 1, 2, 3);
    const levelCell = levelRow.getCell(1);
    levelCell.value = `Official Exam Schedule - ${classDisplayName}`;
    levelCell.font = { bold: true, size: 14, color: { argb: "FF475569" } };
    levelCell.alignment = { horizontal: "center", vertical: "middle" };

    // Meta Info
    const metaRow = sheet.getRow(3);
    metaRow.height = 20;
    sheet.mergeCells(3, 1, 3, 3);
    metaRow.getCell(1).value = `Academic Year: ${
      settings.academicYear || ""
    } | Generated: ${new Date().toLocaleDateString()}`;
    metaRow.getCell(1).alignment = { horizontal: "center" };
    metaRow.getCell(1).font = {
      italic: true,
      size: 10,
      color: { argb: "FF94A3B8" },
    };

    // --- TABLE HEADERS ---
    const tableHeaderRow = sheet.getRow(5);
    tableHeaderRow.height = 30;
    ["Date", "Subject Session 1", "Subject Session 2"].forEach((text, i) => {
      const cell = tableHeaderRow.getCell(i + 1);
      cell.value = text;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" },
      };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // --- DATA ROWS ---
    const dateGroups: Record<string, ExamSession[]> = {};
    levelExams.forEach((e) => {
      if (!dateGroups[e.date]) dateGroups[e.date] = [];
      dateGroups[e.date].push(e);
    });

    const uniqueDates = Object.keys(dateGroups).sort();
    let currentRowIdx = 6;

    uniqueDates.forEach((date) => {
      const examsOnDate = dateGroups[date].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );

      const subjectGroups: Record<string, ExamSession[]> = {};
      examsOnDate.forEach((e) => {
        if (!subjectGroups[e.subjectId]) subjectGroups[e.subjectId] = [];
        subjectGroups[e.subjectId].push(e);
      });

      const sortedSubjectGroups = Object.values(subjectGroups).sort(
        (ga, gb) => {
          const ma = ga.reduce(
            (min, e) => (e.startTime < min ? e.startTime : min),
            "23:59"
          );
          const mb = gb.reduce(
            (min, e) => (e.startTime < min ? e.startTime : min),
            "23:59"
          );
          return ma.localeCompare(mb);
        }
      );

      const s1Exams = sortedSubjectGroups[0] || [];
      const s2Exams = sortedSubjectGroups[1] || [];

      const formatCellText = (group: ExamSession[]) => {
        if (group.length === 0) return "";
        // Only show paper labels if this subject group has multiple distinct papers (e.g. P1 and P2)
        const showPaper = new Set(group.map((e) => e.paperNumber)).size > 1;
        return group
          .map((e) => {
            const sub = subjects.find((s) => s.id === e.subjectId);
            const paper = showPaper
              ? ` (${e.paperLabel || `P${e.paperNumber}`})`
              : "";
            return `${sub?.name || "???"}${paper}\n${
              e.startTime
            } (${formatDuration(e.duration)})`;
          })
          .join("\n---\n");
      };

      const row = sheet.getRow(currentRowIdx);
      row.height = 70;

      const dCell = row.getCell(1);
      dCell.value = new Date(date).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      dCell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      dCell.font = { bold: true };

      const s1Cell = row.getCell(2);
      s1Cell.value = formatCellText(s1Exams);
      s1Cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };

      const s2Cell = row.getCell(3);
      s2Cell.value = formatCellText(s2Exams);
      s2Cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };

      // Apply Colors
      [s1Exams, s2Exams].forEach((grp, i) => {
        if (grp.length > 0) {
          const sub = subjects.find((s) => s.id === grp[0].subjectId);
          if (sub?.color) {
            const cell = row.getCell(i + 2);
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: hexToArgb(sub.color) },
            };
            cell.font = {
              color: { argb: getContrastColor(sub.color) },
              bold: true,
              size: 11,
            };
          }
        }
      });

      // Borders
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      currentRowIdx++;
    });

    // Add Footer
    const footerRow = sheet.getRow(currentRowIdx + 1);
    sheet.mergeCells(currentRowIdx + 1, 1, currentRowIdx + 1, 3);
    footerRow.getCell(1).value =
      "PLEASE BE AT THE EXAM VENUE 30 MINUTES BEFORE START TIME";
    footerRow.getCell(1).font = {
      bold: true,
      size: 10,
      color: { argb: "FFEF4444" },
    };
    footerRow.getCell(1).alignment = { horizontal: "center" };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  await FileService.saveExport(new Blob([buffer]), "School_Exam_Timetables_A4.xlsx", "xlsx");
};

// --- PDF (PRINT) EXPORT ---
export const exportExamsToPDF = (data: AppData) => {
  const { exams, subjects, classes, settings } = data;

  const levelGroups: Record<string, { ids: string[]; names: string[] }> = {};
  classes.forEach((cls) => {
    const lvl = getStreamLevel(cls.id, classes);
    if (!levelGroups[lvl]) levelGroups[lvl] = { ids: [], names: [] };
    levelGroups[lvl].ids.push(cls.id);
    levelGroups[lvl].names.push(cls.name);
  });

  const sortedLevels = Object.keys(levelGroups).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Class Exam Timetables</title>
      <style>
        @page { size: portrait; margin: 10mm; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; margin: 0; padding: 0; font-size: 14px; }
        .page { page-break-after: always; padding: 20px; min-height: 95vh; display: flex; flex-direction: column; }
        .header { text-align: center; margin-bottom: 25px; border-bottom: 4px solid #0f172a; padding-bottom: 15px; }
        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; color: #0f172a; }
        .header h2 { margin: 8px 0 0; font-size: 20px; color: #475569; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { background-color: #0f172a; color: white; border: 1px solid #0f172a; padding: 12px; text-align: center; font-size: 13px; text-transform: uppercase; }
        td { border: 1px solid #cbd5e1; padding: 15px; font-size: 14px; vertical-align: top; overflow: hidden; }
        .date-cell { background-color: #f8fafc; font-weight: bold; width: 120px; text-align: center; vertical-align: middle; }
        .exam-box { margin-bottom: 10px; border-radius: 6px; padding: 10px; }
        .subject-title { font-weight: 900; text-transform: uppercase; font-size: 15px; margin-bottom: 4px; }
        .meta-line { font-size: 12px; opacity: 0.9; font-weight: bold; }
        .footer { margin-top: auto; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
  `;

  sortedLevels.forEach((level, idx) => {
    const group = levelGroups[level];
    const allLevelExams = exams.filter((e) =>
      e.classIds.some((cid) => group.ids.includes(cid))
    );

    if (allLevelExams.length === 0) return;

    // DEDUPLICATE: Multi-stream classes write the same exams.
    const levelExams: ExamSession[] = [];
    const seen = new Set<string>();
    allLevelExams.forEach((e) => {
      const key = `${e.subjectId}-${e.paperNumber}-${e.date}-${e.startTime}`;
      if (!seen.has(key)) {
        levelExams.push(e);
        seen.add(key);
      }
    });

    const classDisplayName = group.names.join(" & ");
    const dateGroups: Record<string, ExamSession[]> = {};
    levelExams.forEach((e) => {
      if (!dateGroups[e.date]) dateGroups[e.date] = [];
      dateGroups[e.date].push(e);
    });
    const uniqueDates = Object.keys(dateGroups).sort();

    html += `
      <div class="page">
        <div class="header">
          <h1>${settings.schoolName || "School"} Exam Timetable</h1>
          <h2>Class: ${classDisplayName}</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 120px;">Exam Date</th>
              <th>Session 1</th>
              <th>Session 2</th>
            </tr>
          </thead>
          <tbody>
    `;

    uniqueDates.forEach((date) => {
      const examsOnDate = dateGroups[date].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );

      const subjectGroups: Record<string, ExamSession[]> = {};
      examsOnDate.forEach((e) => {
        if (!subjectGroups[e.subjectId]) subjectGroups[e.subjectId] = [];
        subjectGroups[e.subjectId].push(e);
      });

      const sortedSubjectGroups = Object.values(subjectGroups).sort(
        (ga, gb) => {
          const ma = ga.reduce(
            (min, e) => (e.startTime < min ? e.startTime : min),
            "23:59"
          );
          const mb = gb.reduce(
            (min, e) => (e.startTime < min ? e.startTime : min),
            "23:59"
          );
          return ma.localeCompare(mb);
        }
      );

      const s1Exams = sortedSubjectGroups[0] || [];
      const s2Exams = sortedSubjectGroups[1] || [];

      const renderSubject = (group: ExamSession[]) => {
        if (group.length === 0) return "";
        // Only show paper labels if this subject group has multiple distinct papers (e.g. P1 and P2)
        const showPaper = new Set(group.map((e) => e.paperNumber)).size > 1;

        return group
          .map((e) => {
            const sub = subjectMap.get(e.subjectId);
            const paperLabel = showPaper
              ? `<div>${e.paperLabel || `P${e.paperNumber}`}</div>`
              : "";
            return `
            <div class="exam-box" style="background-color: ${
              sub?.color || "#f1f5f9"
            }20; border-left: 5px solid ${sub?.color || "#cbd5e1"}">
              <div class="subject-title" style="color: ${
                sub?.color || "#0f172a"
              }">${sub?.name || "Unknown"}</div>
              <div class="meta-line">${paperLabel}</div>
              <div class="meta-line" style="color: #64748b;">${
                e.startTime
              } (${formatDuration(e.duration)})</div>
            </div>
          `;
          })
          .join("");
      };

      html += `
        <tr>
          <td class="date-cell">${new Date(date).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}</td>
          <td>${renderSubject(s1Exams)}</td>
          <td>${renderSubject(s2Exams)}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <div class="footer">
          <span>Official Student Timetable</span>
          <span>Class: ${classDisplayName} | Page ${idx + 1}</span>
        </div>
      </div>
    `;
  });

  html += `</body></html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }
};

// --- INVIGILATOR ROSTER EXPORTS (STAFF VERSION) ---

export const exportInvigilatorsToExcel = async (
  data: AppData,
  currentExams?: ExamSession[]
) => {
  const { teachers, classes } = data;
  const exams = currentExams || data.exams; // Use state exams if provided
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduScheduler Pro";
  const worksheet = workbook.addWorksheet("Invigilation Roster");

  // Page Setup for A3 Landscape
  worksheet.pageSetup = {
    // @ts-ignore
    paperSize: 8, // A3
    orientation: "landscape",
    fitToPage: true,
    fitToHeight: 1,
    fitToWidth: 1,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.3,
      bottom: 0.3,
      header: 0,
      footer: 0,
    },
  };

  const uniqueDates = Array.from(new Set(exams.map((e) => e.date))).sort();
  const sortedClasses = [...classes].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );

  // --- HEADERS ---
  const totalCols = uniqueDates.length + 1;

  // School Name
  worksheet.mergeCells(1, 1, 1, totalCols);
  const schoolRow = worksheet.getRow(1);
  schoolRow.height = 35;
  const schoolCell = schoolRow.getCell(1);
  schoolCell.value = data.settings.schoolName?.toUpperCase() || "SCHOOL NAME";
  schoolCell.font = { bold: true, size: 22 };
  schoolCell.alignment = { horizontal: "center", vertical: "middle" };

  // Title
  worksheet.mergeCells(2, 1, 2, totalCols);
  const titleRow = worksheet.getRow(2);
  titleRow.height = 25;
  const titleCell = titleRow.getCell(1);
  titleCell.value = "INVIGILATION ROSTER";
  titleCell.font = { bold: true, size: 16, color: { argb: "FF475569" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // Meta
  worksheet.mergeCells(3, 1, 3, totalCols);
  const metaCell = worksheet.getRow(3).getCell(1);
  metaCell.value = `Academic Year: ${
    data.settings.academicYear || ""
  } | Generated: ${new Date().toLocaleDateString()}`;
  metaCell.font = { italic: true, size: 11, color: { argb: "FF94A3B8" } };
  metaCell.alignment = { horizontal: "center" };

  // Define Column Keys and Widths (Starting Row 5)
  // Note: We don't set 'header' here because it would overwrite Row 1
  const columns = [{ header: "Class / Date", key: "className", width: 25 }];
  uniqueDates.forEach((date) => {
    columns.push({
      header: new Date(date).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      key: date,
      width: 30,
    });
  });
  
  // Set keys and widths without triggering automatic header row writing
  worksheet.columns = columns.map(c => ({ key: c.key, width: c.width }));

  // WRITE HEADERS EXPLICITLY TO ROW 5
  const headerRow = worksheet.getRow(5);
  headerRow.height = 30;
  columns.forEach((col, i) => {
    headerRow.getCell(i + 1).value = col.header;
  });

  // Header Style (Row 5)
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Data Rows
  sortedClasses.forEach((cls) => {
    const rowData: any = { className: cls.name };
    uniqueDates.forEach((date) => {
      const teamIds = getClassDayInvigilationTeam(exams, cls.id, date);
      rowData[date] = teamIds
        .map((id) => teachers.find((t) => t.id === id)?.name)
        .filter(Boolean)
        .join("\n");
    });
    const row = worksheet.addRow(rowData);
    row.height = 60;
    row.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  await FileService.saveExport(new Blob([buffer]), "Invigilation_Master_Roster_A3.xlsx", "xlsx");
};

export const exportInvigilatorsToPDF = (
  data: AppData,
  currentExams?: ExamSession[]
) => {
  const { teachers, classes, settings } = data;
  const exams = currentExams || data.exams;
  const uniqueDates = Array.from(new Set(exams.map((e) => e.date))).sort();
  const sortedClasses = [...classes].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invigilation Roster A3</title>
      <style>
        @page { size: A3 landscape; margin: 10mm; }
        body { font-family: 'Segoe UI', sans-serif; font-size: 14px; color: #1e293b; padding: 10px; }
        h1 { text-align: center; text-transform: uppercase; margin-bottom: 5px; font-size: 28px; }
        h2 { text-align: center; color: #64748b; margin-top: 0; margin-bottom: 30px; font-size: 20px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { background-color: #0f172a; color: white; border: 1px solid #0f172a; padding: 12px; font-size: 12px; }
        td { border: 1px solid #cbd5e1; padding: 10px; vertical-align: middle; height: 90px; word-wrap: break-word; text-align: center; }
        .class-col { background-color: #f8fafc; font-weight: bold; width: 120px; text-align: left; font-size: 14px; border-left: 2px solid #0f172a; }
        .staff-tag { display: block; background: #f1f5f9; padding: 5px 8px; border-radius: 4px; margin-bottom: 4px; font-size: 13px; border: 1px solid #e2e8f0; font-weight: bold; color: #1e293b; }
      </style>
    </head>
    <body>
      <h1>${settings.schoolName || "School"} Invigilation Master Roster</h1>
      <h2>Class vs Date — one invigilator per session</h2>
      <table>
        <thead>
          <tr>
            <th class="class-col">Class / Date</th>
            ${uniqueDates.map(d => `
              <th>
                <div style="font-size: 10px; color: #94a3b8; margin-bottom: 2px;">${new Date(d).toLocaleDateString("en-GB", { weekday: 'short' }).toUpperCase()}</div>
                <div style="font-size: 14px;">${new Date(d).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })}</div>
              </th>
            `).join("")}
          </tr>
        </thead>
        <tbody>
  `;

  sortedClasses.forEach((cls) => {
    html += `<tr><td class="class-col">${cls.name}</td>`;
    uniqueDates.forEach((date) => {
      const teamIds = getClassDayInvigilationTeam(exams, cls.id, date);
      const tags = teamIds
        .map((id) => {
          const name = teachers.find((t) => t.id === id)?.name;
          return name ? `<span class="staff-tag">${name}</span>` : "";
        })
        .join("");

      html += `<td>${tags}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></body></html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }
};
