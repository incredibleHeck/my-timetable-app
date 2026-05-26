import { AppData, ScheduleSlot, Subject, Teacher, ClassGroup } from "../../types";
import { calculateClassSchedule, getFormattedTimeRange } from "../../utils/timeUtils";
import { getOccasionLabel } from "../../utils/utils";

// --- HELPER: GET DURATION ---
const getDuration = (data: any, classId: string, d: number, p: number): number => {
  const slot = data.schedule[classId]?.[d]?.[p];
  if (!slot) return 1;
  const nextSlot = data.schedule[classId]?.[d]?.[p + 1];
  if (nextSlot && nextSlot.isFixed && nextSlot.subjectId === slot.subjectId) {
    return 2;
  }
  return 1;
};

// --- MAIN EXPORT FUNCTION ---
export const printAllSchedules = (data: AppData, mode: "CLASS" | "TEACHER") => {
  const { settings, schedule, classes, teachers, subjects } = data;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // --- 1. OPTIMIZATION: Create Maps (Fast Lookups) ---
  const subjectMap = new Map<string, Subject>(subjects.map((s: Subject) => [s.id, s]));
  const teacherMap = new Map<string, Teacher>(teachers.map((t: Teacher) => [t.id, t]));
  const classMap = new Map<string, ClassGroup>(classes.map((c: ClassGroup) => [c.id, c]));

  // --- 2. PREPARATION: Sort Entities ---
  const entities =
    mode === "CLASS"
      ? [...classes].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true })
        )
      : [...teachers].sort((a, b) => a.name.localeCompare(b.name));

  // --- 3. BUILD HTML ---
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${settings.schoolName || "Schedule Export"}</title>
      <style>
        @page { size: A4 landscape; margin: 5mm; }
        body { 
          font-family: 'Inter', 'Segoe UI', sans-serif; 
          margin: 0; padding: 0; 
          color: #0f172a; 
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .page-break { page-break-after: always; }
        
        /* LAYOUT */
        .schedule-container {
          width: 297mm; height: 210mm;
          display: flex; flex-direction: column;
          background-color: white; padding: 10mm; box-sizing: border-box;
          page-break-inside: avoid;
        }

        /* HEADER */
        .header {
          display: flex; justify-content: space-between; align-items: flex-end;
          margin-bottom: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 8px;
        }
        .header-left h1 {
          font-size: 20px; font-weight: 800; text-transform: uppercase;
          margin: 0; color: #0f172a;
        }
        .header-right { text-align: right; }
        .header-right h2 { font-size: 16px; margin: 0; color: #334155; }

        /* TABLE */
        table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 2px solid #0f172a; }
        
        th {
          border: 1px solid #0f172a; padding: 4px;
          background-color: #f1f5f9; font-weight: bold; font-size: 10px;
          color: #0f172a; height: 30px;
        }

        .day-label {
          border: 1px solid #0f172a; padding: 4px;
          background-color: #f1f5f9; font-weight: bold; font-size: 11px;
          text-transform: uppercase; text-align: center; width: 45px;
        }

        td {
          border: 1px solid #94a3b8; padding: 2px;
          vertical-align: middle; font-size: 10px; text-align: center;
          height: 60px; overflow: hidden;
        }

        .lesson-cell {
          height: 100%; display: flex; flex-direction: column; justify-content: center;
          border-radius: 4px; padding: 2px;
        }
        .subj-name { font-weight: 800; font-size: 11px; line-height: 1.1; margin-bottom: 2px; }
        .detail-name { font-size: 9px; color: #475569; font-weight: 500; }

        .break-cell {
          background-color: #f8fafc; color: #94a3b8; 
          font-weight: bold; font-size: 9px; text-transform: uppercase;
          letter-spacing: 1px;
        }

        .footer {
          margin-top: 5px; display: flex; justify-content: space-between; 
          font-size: 9px; color: #64748b; font-style: italic;
        }
      </style>
    </head>
    <body>
  `;

  entities.forEach((entity, index) => {
    // Determine Structure for this entity
    const currentClass = mode === "CLASS" ? (entity as ClassGroup) : null;
    const currentStructure = currentClass?.structure?.length
        ? currentClass.structure
        : settings.dayStructure;
    
    const classSchedule = currentClass 
        ? calculateClassSchedule(currentClass, settings, currentStructure)
        : [];
    
    const maxPeriods = currentClass
        ? (currentStructure.length || currentClass.periodCount || settings.periodsPerDay)
        : settings.periodsPerDay;

    const periods = Array.from({ length: maxPeriods }, (_, i) => i);

    // Helper for sequential numbering
    const getPeriodLabel = (pIdx: number) => {
        const item = currentStructure?.[pIdx];
        const type = typeof item === "string" ? item : item?.type;
        const effectiveType = type || "CLASS"; 

        if (effectiveType !== "CLASS") {
            const label = typeof item === "string" ? item : item?.label || item?.type;
            return label?.toUpperCase() || "BREAK";
        }

        let classCount = 0;
        for (let i = 0; i <= pIdx; i++) {
            const pItem = currentStructure?.[i];
            const pType = typeof pItem === "string" ? pItem : pItem?.type;
            if ((pType || "CLASS") === "CLASS") classCount++;
        }
        return `P${classCount}`;
    };

    htmlContent += `
      <div class="schedule-container">
        <div class="header">
          <div class="header-left">
            <h1>${settings.schoolName || "SCHOOL TIMETABLE"}</h1>
          </div>
          <div class="header-right">
            <h2>${mode === "CLASS" ? "Class" : "Teacher"}: ${entity.name}</h2>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 45px;">DAY</th>
              ${periods.map((p) => {
                  let timeSlot = settings.timeSlots?.[p];
                  if (mode === "CLASS" && classSchedule[p]) {
                      timeSlot = classSchedule[p];
                  }
                  
                  const timeLabel = timeSlot 
                    ? `<div style="font-weight:normal; font-size:8px;">${getFormattedTimeRange(timeSlot)}</div>`
                    : "";
                  return `<th>${getPeriodLabel(p)}${timeLabel}</th>`;
              }).join("")}
            </tr>
          </thead>
          <tbody>
    `;

    days.forEach((day, dIdx) => {
      htmlContent += `<tr><td class="day-label">${day.substring(0, 3)}</td>`;

      for (let pIdx = 0; pIdx < maxPeriods; pIdx++) {
        const struct = currentStructure?.[pIdx];
        const type = typeof struct === "string" ? struct : struct?.type;
        const isBreak = type && type !== "CLASS";

        if (isBreak) {
          htmlContent += `<td class="break-cell">${(typeof struct === "string" ? struct : struct?.label || type).toUpperCase()}</td>`;
          continue;
        }

        // 1. Check Fixed Sessions (Reserved Slots)
        const globalFixed = settings.fixedOccasions?.[dIdx]?.[pIdx];
        const classFixed = currentClass?.fixedSessions?.[dIdx]?.[pIdx];
        const fixedOccasion = classFixed || globalFixed;

        const fixedLabel = getOccasionLabel(fixedOccasion);
        if (fixedLabel) {
            const label = fixedLabel;
            htmlContent += `
                <td style="background-color: #1e293b; color: #fbbf24; font-weight: bold; font-size: 10px; border: 1px solid #0f172a;">
                    <div class="lesson-cell">
                        <div class="subj-name" style="color: #fbbf24;">${label}</div>
                        <div class="detail-name" style="color: #94a3b8;">OCCASION</div>
                    </div>
                </td>
            `;
            continue;
        }

        // 2. Check Teacher Blocked (for Teacher mode)
        if (mode === "TEACHER") {
            const teacher = teachers.find((t: Teacher) => t.id === entity.id);
            if (teacher?.constraints?.[dIdx]?.[pIdx]) {
                htmlContent += `
                    <td style="background-color: #1e293b; color: #fbbf24; font-weight: bold; font-size: 10px; border: 1px solid #0f172a;">
                        <div class="lesson-cell">
                            <div class="subj-name" style="color: #fbbf24;">BLOCKED</div>
                            <div class="detail-name" style="color: #94a3b8;">UNAVAILABLE</div>
                        </div>
                    </td>
                `;
                continue;
            }
        }

        // Check for double periods to skip "fixed" tails
        let slot = null;
        let classId = mode === "CLASS" ? entity.id : "";
        
        if (mode === "CLASS") {
            slot = schedule[entity.id]?.[dIdx]?.[pIdx];
        } else {
            for (const c of classes) {
                const s = schedule[c.id]?.[dIdx]?.[pIdx];
                if (s && s.teacherId === entity.id) {
                    slot = s; classId = c.id; break;
                }
            }
        }

        if (slot?.isFixed) {
            // Check if this is a tail of a double from previous period
            const prevP = pIdx > 0 ? (mode === "CLASS" ? schedule[entity.id]?.[dIdx]?.[pIdx-1] : null) : null;
            // Note: Simplification for teacher mode tail check might be needed if complex
            if (prevP && prevP.subjectId === slot.subjectId) continue; 
        }

        const duration = slot ? getDuration(data, classId || entity.id, dIdx, pIdx) : 1;
        const colspan = duration > 1 ? `colspan="${duration}"` : "";
        
        let content = "—";
        let style = "";

        if (slot) {
            const subject = subjectMap.get(slot.subjectId);
            const subName = subject?.name || "Subject";
            const subColor = subject?.color || "#cbd5e1";
            const detailName = mode === "CLASS" 
                ? (teacherMap.get(slot.teacherId)?.name || "Staff")
                : (classMap.get(classId)?.name || "Class");
            
            const subLower = subName.toLowerCase();
            const isSpecial = slot.locked || subLower.includes("worship") || subLower.includes("assembly") || subLower.includes("club") || subLower.includes("meeting");

            if (isSpecial) {
                style = `background-color: #0f172a; color: #fbbf24; border: 1px solid #0f172a;`;
                content = `
                    <div class="lesson-cell">
                        <div class="subj-name" style="color: #fbbf24;">${subName}</div>
                        <div class="detail-name" style="color: #94a3b8;">${detailName}</div>
                    </div>
                `;
            } else {
                style = `background-color: ${subColor}15; border-left: 4px solid ${subColor};`;
                content = `
                    <div class="lesson-cell">
                        <div class="subj-name">${subName}</div>
                        <div class="detail-name">${detailName}</div>
                    </div>
                `;
            }
            if (duration > 1) pIdx += (duration - 1); // Skip next period cell
        }

        htmlContent += `<td ${colspan} style="${style}">${content}</td>`;
      }
      htmlContent += `</tr>`;
    });

    htmlContent += `
          </tbody>
        </table>
        
        <div class="footer">
          <span>Generated by EduScheduler Pro • ${new Date().toLocaleDateString()}</span>
          <span>${entity.name} • Page ${index + 1} of ${entities.length}</span>
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
  }
};
