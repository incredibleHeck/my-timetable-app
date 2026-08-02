import { FileService } from "../fileSystem";
import { loadExcelJS } from "./excelLoader";

export const exportWorkloadToExcel = async (
  workloadStats: any[],
  notify: (msg: string, type?: any) => void
) => {
  try {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "EduScheduler Pro";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Faculty Workload");

    // Define columns
    worksheet.columns = [
      { header: "Teacher Name", key: "name", width: 25 },
      { header: "Requested Periods", key: "requested", width: 18 },
      { header: "Scheduled Periods", key: "scheduled", width: 18 },
      { header: "Blocked Slots", key: "blocked", width: 15 },
      { header: "Max Weekly Periods", key: "max", width: 20 },
      { header: "Utilization %", key: "utilization", width: 15 },
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334155" }, // slate-700
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    
    // Add Rows
    workloadStats.forEach((s) => {
      const row = worksheet.addRow({
        name: s.t.name,
        requested: s.assignedPeriods,
        scheduled: s.scheduledPeriods,
        blocked: s.blockedSlots,
        max: s.maxWeeklyCapacity,
        utilization: s.utilizationPct / 100, // Excel handles percentages as decimals
      });

      // Format Utilization column as percentage
      const utilCell = row.getCell("utilization");
      utilCell.numFmt = "0.0%";
      
      // Conditional formatting based on utilization
      if (s.utilizationPct > 100) {
        utilCell.font = { color: { argb: "FFDC2626" }, bold: true }; // Red
      } else if (s.utilizationPct > 85) {
        utilCell.font = { color: { argb: "FFD97706" }, bold: true }; // Amber
      } else {
        utilCell.font = { color: { argb: "FF059669" } }; // Emerald
      }
      
      // Basic alignment for numbers
      row.getCell("requested").alignment = { horizontal: "center" };
      row.getCell("scheduled").alignment = { horizontal: "center" };
      row.getCell("blocked").alignment = { horizontal: "center" };
      row.getCell("max").alignment = { horizontal: "center" };
      utilCell.alignment = { horizontal: "center" };
    });

    // Add borders to all cells
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });
    });

    // Save File
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = "Faculty_Workload_Report.xlsx";
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const saveResult = await FileService.saveExport(blob, fileName, "xlsx");
    if (saveResult.success) {
      notify("Workload report exported to Excel successfully.", "success");
    }
  } catch (err) {
    console.error("Failed to export workload report:", err);
    notify("Failed to export workload report.", "error");
  }
};
