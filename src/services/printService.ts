import { AppData, ScheduleSlot } from "../types";

export const printAllSchedules = (data: AppData, mode: "CLASS" | "TEACHER") => {
  const { settings, schedule, classes, teachers, subjects } = data;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // --- 1. OPTIMIZATION: Create Maps (Fast Lookups) ---
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const classMap = new Map(classes.map((c) => [c.id, c]));

  // --- 2. PREPARATION: Sort Entities ---
  const entities =
    mode === "CLASS"
      ? [...classes].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true })
        )
      : [...teachers].sort((a, b) => a.name.localeCompare(b.name));

  const periods = Array.from({ length: settings.periodsPerDay }, (_, i) => i);

  // --- 3. HELPER: Get Slot Data ---
  const getSlot = (
    entityId: string,
    dayIndex: number,
    periodIndex: number
  ): ScheduleSlot | undefined => {
    if (mode === "CLASS") {
      return schedule[entityId]?.[dayIndex]?.[periodIndex];
    } else {
      // Reverse lookup for teachers
      for (const classId of Object.keys(schedule)) {
        const slot = schedule[classId]?.[dayIndex]?.[periodIndex];
        if (slot && slot.teacherId === entityId) {
          return slot;
        }
      }
      return undefined;
    }
  };

  // --- 4. BUILD HTML ---
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${settings.schoolName || "Schedule Export"}</title>
      <style>
        @page { size: landscape; margin: 10mm; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 0; padding: 0; 
          color: #0f172a; 
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .page-break { page-break-after: always; }
        
        /* LAYOUT */
        .schedule-container {
          width: 100%; height: 98vh;
          display: flex; flex-direction: column;
          background-color: white; padding: 20px; box-sizing: border-box;
        }

        /* HEADER */
        .header {
          text-align: center; margin-bottom: 20px;
          border-bottom: 4px solid #1e293b; padding-bottom: 16px;
        }
        .header h1 {
          font-size: 24px; fontWeight: 900; text-transform: uppercase;
          letter-spacing: 2px; margin-bottom: 5px; margin-top: 0;
        }
        .header h2 {
          font-size: 18px; font-weight: bold; color: #475569; margin: 5px 0;
        }
        .header .meta { font-size: 12px; color: #64748b; margin-top: 8px; }

        /* TABLE */
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        
        th {
          border: 2px solid #1e293b; padding: 8px;
          background-color: #f1f5f9; font-weight: bold; font-size: 11px;
          text-transform: uppercase; color: #0f172a;
        }

        .day-label {
          border: 2px solid #1e293b; padding: 8px;
          background-color: #e2e8f0; font-weight: bold; font-size: 12px;
          text-transform: uppercase; text-align: center; vertical-align: middle;
          width: 60px;
        }

        td {
          border: 1px solid #cbd5e1; padding: 4px;
          vertical-align: top; font-size: 10px; text-align: center;
          height: 55px; /* Reduced height for rectangular look */
        }

        .cell-content {
          display: flex; flex-direction: column; gap: 2px;
          height: 100%; justifyContent: center; width: 100%;
        }

        .subject-text { font-weight: bold; font-size: 11px; }
        .detail-text { font-size: 9px; }

        .footer {
          margin-top: auto; padding-top: 12px; border-top: 1px solid #e2e8f0;
          display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;
        }
      </style>
    </head>
    <body>
  `;

  entities.forEach((entity, index) => {
    htmlContent += `
      <div class="schedule-container">
        <div class="header">
          <h1>${settings.schoolName || "School Timetable"}</h1>
          <h2>${mode === "CLASS" ? "Class Group" : "Faculty Member"}: 
            <span style="color: #0f172a">${entity.name}</span>
          </h2>
          <div class="meta">
            Generated: ${new Date().toLocaleDateString()}
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Day</th>
              ${periods
                .map((p) => {
                  const timeLabel =
                    settings.timeSlots?.[p]?.start || `P${p + 1}`;
                  return `<th><div>P${
                    p + 1
                  }</div><div style="font-weight:normal; font-size:9px">${timeLabel}</div></th>`;
                })
                .join("")}
            </tr>
          </thead>
          <tbody>
    `;

    days.forEach((day, dayIndex) => {
      htmlContent += `<tr>
        <td class="day-label">${day.substring(0, 3)}</td>`;

      periods.forEach((periodIndex) => {
        // --- LOGIC START ---

        // 1. Check Global Structure (Break/Lunch)
        const struct = settings.dayStructure?.[periodIndex];
        const isLunch = struct?.type === "LUNCH";
        const isBreak = struct?.type === "BREAK";

        // 2. Check Global Fixed Occasions
        const globalFixed = settings.fixedOccasions?.[dayIndex]?.[periodIndex];

        let inlineStyle = "";
        let content = "";

        if (isLunch) {
          // Yellow Background / Brown Text
          inlineStyle =
            "background-color: #FCD34D; color: #78350F; font-weight: bold;";
          content = "LUNCH";
        } else if (isBreak) {
          // Yellow Background / Brown Text
          inlineStyle =
            "background-color: #FCD34D; color: #78350F; font-weight: bold;";
          content = "BREAK";
        } else if (globalFixed) {
          // GLOBAL FIXED - DARK SLATE BG / AMBER TEXT (No Lock Icon)
          inlineStyle =
            "background-color: #0f172a !important; color: #fbbf24 !important; border: 1px solid #0f172a;";

          const fixedLabel =
            typeof globalFixed === "string" ? globalFixed : "Whole School";

          content = `
            <div class="cell-content">
               <span style="font-size:12px; font-weight:bold;">${fixedLabel}</span>
               <span style="opacity:0.9; font-size:10px;">Event</span>
            </div>
          `;
        } else {
          // 3. Check Schedule Slot
          const slot = getSlot(entity.id, dayIndex, periodIndex);

          if (slot) {
            const subject = subjectMap.get(slot.subjectId);
            const subName = subject?.name || slot.subjectId;
            const subNameLower = subName.toLowerCase();
            const subColor = subject?.color || "#cbd5e1";

            let detailName = "Unknown";
            if (mode === "CLASS") {
              detailName = teacherMap.get(slot.teacherId)?.name || "Unassigned";
            } else {
              detailName = classMap.get(slot.classId)?.name || "Unknown Class";
            }

            // --- FIXED SLOT CHECK ---
            // @ts-ignore
            const isLocked = !!slot.locked;
            const isFixedName =
              subNameLower.includes("worship") ||
              subNameLower.includes("club") ||
              subNameLower.includes("assembly") ||
              subNameLower.includes("meeting");

            if (isLocked || isFixedName) {
              // FORCE DARK SLATE BG / AMBER TEXT INLINE (No Lock Icon)
              inlineStyle = `
                  background-color: #0f172a !important; 
                  color: #fbbf24 !important; 
                  border: 1px solid #0f172a;
                `;
              content = `
                  <div class="cell-content">
                    <span style="font-size:12px; font-weight:bold;">${subName}</span>
                    <span style="opacity:0.9; font-size:10px;">${detailName}</span>
                  </div>
                `;
            } else {
              // REGULAR LESSON
              inlineStyle = `background-color: ${subColor}20;`; // Light background
              content = `
                  <div class="cell-content" style="align-items: flex-start; padding-left: 4px;">
                     <div style="border-left: 3px solid ${subColor}; padding-left: 4px;">
                       <div class="subject-text" style="color: #1e293b;">${subName}</div>
                       <div class="detail-text" style="color: #475569;">${detailName}</div>
                     </div>
                  </div>
                `;
            }
          } else {
            // Empty Slot
            content = "<span style='color:#cbd5e1'>—</span>";
          }
        }

        htmlContent += `<td style="${inlineStyle}">${content}</td>`;
      });

      htmlContent += `</tr>`;
    });

    htmlContent += `
          </tbody>
        </table>
        
        <div class="footer">
          <span>EduScheduler Pro</span>
          <span>Page ${index + 1} of ${entities.length}</span>
        </div>
      </div>
      <div class="page-break"></div>
    `;
  });

  htmlContent += `</body></html>`;

  // --- PRINT EXECUTION ---
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  } else {
    alert("Pop-up blocked. Please allow pop-ups to print the schedule.");
  }
};
