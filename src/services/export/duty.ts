import type ExcelJS from "exceljs";
import { AppData, DutyRoster } from "../../types";
import { DAYS } from "../../utils/constants";
import { FileService } from "../fileSystem";
import { loadExcelJS } from "./excelLoader";

export const exportDutyToExcel = async (data: AppData, roster: DutyRoster) => {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduScheduler Pro";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(roster.name.substring(0, 30));

  const rowLabels = roster.type === "DAILY" ? DAYS : Array.from({ length: roster.weeklyParams.weeks }, (_, i) => `Week ${i + 1}`);
  const assignments = roster.type === "DAILY" ? roster.dailyAssignments : roster.weeklyAssignments;
  const slotCount = roster.type === "DAILY" ? roster.dailyParams.max : roster.weeklyParams.max;

  // HEADER ROW
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;

  const firstCell = headerRow.getCell(1);
  firstCell.value = roster.type === "DAILY" ? "Day / Slot" : "Week / Slot";
  firstCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  firstCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  firstCell.alignment = { vertical: "middle", horizontal: "center" };

  for (let i = 0; i < slotCount; i++) {
    const cell = headerRow.getCell(i + 2);
    cell.value = `Slot ${i + 1}`;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    worksheet.getColumn(i + 2).width = 25;
  }
  worksheet.getColumn(1).width = 15;

  // DATA ROWS
  rowLabels.forEach((label, rIdx) => {
    const row = worksheet.getRow(rIdx + 2);
    row.height = 40;

    const labelCell = row.getCell(1);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 11 };
    labelCell.alignment = { vertical: "middle", horizontal: "center" };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

    for (let sIdx = 0; sIdx < slotCount; sIdx++) {
      const cell = row.getCell(sIdx + 2);
      const asgn = assignments.find(a => a.day === rIdx && a.period === sIdx);
      const teacher = asgn ? data.teachers.find(t => t.id === asgn.teacherId) : null;

      cell.value = teacher ? teacher.name : "—";
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      
      if (teacher) {
        cell.font = { bold: true, color: { argb: "FF1E293B" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFAF2" } };
      }
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${roster.name.replace(/\s+/g, "_")}_Export.xlsx`;
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  await FileService.saveExport(blob, fileName, "xlsx");
};

export const printDutyRoster = (data: AppData, roster: DutyRoster) => {
  const rowLabels = roster.type === "DAILY" ? DAYS : Array.from({ length: roster.weeklyParams.weeks }, (_, i) => `Week ${i + 1}`);
  const assignments = roster.type === "DAILY" ? roster.dailyAssignments : roster.weeklyAssignments;
  const slotCount = roster.type === "DAILY" ? roster.dailyParams.max : roster.weeklyParams.max;

  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${roster.name}</title>
      <style>
        @page { size: landscape; margin: 10mm; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 20px; color: #1e293b; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 4px solid #f59e0b; padding-bottom: 20px; }
        .header h1 { font-size: 28px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
        .header p { color: #64748b; font-size: 14px; margin: 5px 0 0 0; font-weight: bold; }
        
        table { width: 100%; border-collapse: collapse; table-layout: fixed; background: white; }
        th { 
          background: #0f172a; color: white; border: 1px solid #0f172a; 
          padding: 12px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
        }
        td { border: 1px solid #e2e8f0; padding: 12px 8px; text-align: center; font-size: 12px; height: 50px; }
        .row-label { background: #f8fafc; font-weight: 900; color: #475569; width: 100px; border-right: 2px solid #e2e8f0; }
        .staff-name { font-weight: bold; color: #1e293b; }
        .empty-slot { color: #cbd5e1; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${roster.name}</h1>
        <p>${roster.type} STAFF ROTATION SCHEDULE • GENERATED ${new Date().toLocaleDateString()}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th class="row-label">${roster.type === "DAILY" ? "Day" : "Week"}</th>
            ${Array.from({ length: slotCount }).map((_, i) => `<th>Slot ${i + 1}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rowLabels.map((label, rIdx) => `
            <tr>
              <td class="row-label">${label}</td>
              ${Array.from({ length: slotCount }).map((_, sIdx) => {
                const asgn = assignments.find(a => a.day === rIdx && a.period === sIdx);
                const teacher = asgn ? data.teachers.find(t => t.id === asgn.teacherId) : null;
                return `<td><span class="${teacher ? 'staff-name' : 'empty-slot'}">${teacher ? teacher.name : '—'}</span></td>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="footer">
        <span>EduScheduler Pro • Duty Management Module</span>
        <span>Printed on ${new Date().toLocaleString()}</span>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }
};