import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportScheduleToExcel } from "../src/services/export/excel";
import { exportDutyToExcel, printDutyRoster } from "../src/services/export/duty";
import {
  exportExamsToExcel,
  exportExamsToPDF,
  exportInvigilatorsToExcel,
  exportInvigilatorsToPDF,
} from "../src/services/export/exams";
import { printAllSchedules } from "../src/services/export/print";
import { FileService } from "../src/services/fileSystem";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData, DutyRoster } from "../src/types";

// Mock FileService
vi.mock("../src/services/fileSystem", () => ({
  FileService: {
    saveExport: vi.fn().mockResolvedValue({ success: true, path: "/mock/save/path.xlsx" }),
  },
}));

// Mock loadExcelJS to avoid importing/parsing the heavy exceljs library during tests
vi.mock("../src/services/export/excelLoader", () => {
  class MockCell {
    _value: any = "";
    get value() {
      return this._value;
    }
    set value(v: any) {
      this._value = v;
    }
    font: any = {};
    alignment: any = {};
    border: any = {};
    fill: any = {};
  }

  class MockRow {
    cells = new Map<number, MockCell>();
    height = 0;
    getCell(colIndex: number) {
      if (!this.cells.has(colIndex)) {
        this.cells.set(colIndex, new MockCell());
      }
      return this.cells.get(colIndex)!;
    }
    eachCell(arg1: any, arg2?: any) {
      const callback = typeof arg1 === "function" ? arg1 : arg2;
      if (typeof callback === "function") {
        this.cells.forEach((cell, idx) => {
          callback(cell, idx);
        });
      }
    }
  }

  class MockWorksheet {
    name: string;
    pageSetup: any = {};
    columns: any[] = [];
    rows = new Map<number, MockRow>();
    constructor(name: string) {
      this.name = name;
    }
    getRow(rowIndex: number) {
      if (!this.rows.has(rowIndex)) {
        this.rows.set(rowIndex, new MockRow());
      }
      return this.rows.get(rowIndex)!;
    }
    addRow(data: any) {
      const rowIndex = this.rows.size + 1;
      const row = this.getRow(rowIndex);
      if (typeof data === "object" && data !== null) {
        Object.keys(data).forEach((key, i) => {
          row.getCell(i + 1).value = data[key];
        });
      }
      return row;
    }
    getColumn(colIndex: number) {
      return { width: 0 };
    }
    mergeCells(...args: any[]) {}
  }

  return {
    loadExcelJS: vi.fn().mockResolvedValue({
      Workbook: class MockWorkbook {
        creator = "";
        created = new Date();
        worksheets: MockWorksheet[] = [];
        addWorksheet(name: string) {
          const sheet = new MockWorksheet(name);
          this.worksheets.push(sheet);
          return sheet;
        }
        xlsx = {
          writeBuffer: vi.fn().mockResolvedValue(Buffer.from("mock excel buffer")),
        };
      },
    }),
  };
});

describe("Consolidated Export Services Suite", () => {
  let mockWindowOpen: any;
  let mockPrint: any;
  let mockClose: any;
  let mockDocumentWrite: any;
  let mockDocumentClose: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrint = vi.fn();
    mockClose = vi.fn();
    mockDocumentWrite = vi.fn();
    mockDocumentClose = vi.fn();

    const mockWindow = {
      document: {
        write: mockDocumentWrite,
        close: mockDocumentClose,
      },
      print: mockPrint,
      close: mockClose,
      focus: vi.fn(),
    };

    mockWindowOpen = vi.fn().mockReturnValue(mockWindow);
    vi.stubGlobal("window", { open: mockWindowOpen });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const baseTestData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      schoolName: "Test School",
      academicYear: "2026",
      periodsPerDay: 4,
      dayStructure: [
        { type: "CLASS", label: "P1" },
        { type: "CLASS", label: "P2" },
        { type: "BREAK", label: "Recess" },
        { type: "CLASS", label: "P3" },
      ],
      timeSlots: [
        { start: "08:00", end: "08:50" },
        { start: "08:50", end: "09:40" },
        { start: "09:40", end: "10:00" },
        { start: "10:00", end: "10:50" },
      ],
    },
    subjects: [{ id: "s1", name: "Math", color: "#2563eb" }],
    teachers: [
      {
        id: "t1",
        name: "Teacher One",
        specialtyIds: ["s1"],
        constraints: Array(5)
          .fill(null)
          .map(() => Array(4).fill(false)),
      },
    ],
    rooms: [{ id: "r1", name: "Room 101", capacity: 30, type: "GENERAL" }],
    classes: [
      {
        id: "c1",
        name: "Class 10A",
        defaultRoomId: "r1",
        curriculum: [
          {
            id: "curr1",
            subjectId: "s1",
            singles: 4,
            doubles: 0,
            assignedTeacherId: "t1",
            periodsPerWeek: 4,
          },
        ],
      },
    ],
    schedule: {
      c1: {
        "0": {
          "0": {
            id: "u1",
            classId: "c1",
            subjectId: "s1",
            teacherId: "t1",
            roomId: "r1",
            day: 0,
            period: 0,
            isFixed: true,
          },
        },
      },
    },
    exams: [
      {
        id: "e1",
        subjectId: "s1",
        classIds: ["c1"],
        date: "2026-06-01",
        startTime: "09:00",
        duration: 120,
        paperNumber: 1,
        paperLabel: "P1",
        invigilatorIds: ["t1"],
      },
    ],
    conflicts: [],
  };

  const testRoster: DutyRoster = {
    id: "r1",
    name: "Morning Duty",
    type: "DAILY",
    dailyParams: { max: 2 },
    weeklyParams: { weeks: 1, max: 2 },
    dailyAssignments: [{ day: 0, period: 0, teacherId: "t1" }],
    weeklyAssignments: [],
  };

  // ----------------------------------------------------
  // excel-export.test.ts tests
  // ----------------------------------------------------
  describe("Schedule Excel Export", () => {
    it("should successfully generate and save Excel file for CLASS mode", async () => {
      await exportScheduleToExcel(baseTestData, "CLASS");

      expect(FileService.saveExport).toHaveBeenCalledTimes(1);
      const [blob, fileName, extension] = vi.mocked(FileService.saveExport).mock.calls[0];

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(fileName).toBe("Full_Classes_Schedule.xlsx");
      expect(extension).toBe("xlsx");
    }, 30000);

    it("should successfully generate and save Excel file for TEACHER mode", async () => {
      await exportScheduleToExcel(baseTestData, "TEACHER");

      expect(FileService.saveExport).toHaveBeenCalledTimes(1);
      const [blob, fileName, extension] = vi.mocked(FileService.saveExport).mock.calls[0];

      expect(blob).toBeInstanceOf(Blob);
      expect(fileName).toBe("Full_Faculty_Schedule.xlsx");
      expect(extension).toBe("xlsx");
    }, 30000);

    it("should warn and exit if no entities are available to export", async () => {
      const emptyData: AppData = {
        ...baseTestData,
        classes: [],
        teachers: [],
      };

      await exportScheduleToExcel(emptyData, "CLASS");
      expect(FileService.saveExport).not.toHaveBeenCalled();
    }, 15000);
  });

  // ----------------------------------------------------
  // duty-export.test.ts tests
  // ----------------------------------------------------
  describe("Duty Export & Print", () => {
    it("should successfully generate and save Excel file for duty roster", async () => {
      await exportDutyToExcel(baseTestData, testRoster);

      expect(FileService.saveExport).toHaveBeenCalledTimes(1);
      const [blob, fileName, extension] = vi.mocked(FileService.saveExport).mock.calls[0];

      expect(blob).toBeInstanceOf(Blob);
      expect(fileName).toBe("Morning_Duty_Export.xlsx");
      expect(extension).toBe("xlsx");
    }, 30000);

    it("should open print window and write HTML for duty roster", () => {
      vi.useFakeTimers();
      printDutyRoster(baseTestData, testRoster);

      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      expect(mockDocumentWrite).toHaveBeenCalledTimes(1);

      const htmlContent = mockDocumentWrite.mock.calls[0][0];
      expect(htmlContent).toContain("Morning Duty");
      expect(htmlContent).toContain("Teacher One");

      vi.runAllTimers();
      expect(mockPrint).toHaveBeenCalledTimes(1);
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------
  // exams-export.test.ts tests
  // ----------------------------------------------------
  describe("Exams Export & Print", () => {
    it("should successfully generate and save Excel file for exams", async () => {
      await exportExamsToExcel(baseTestData);

      expect(FileService.saveExport).toHaveBeenCalledTimes(1);
      const [blob, fileName, extension] = vi.mocked(FileService.saveExport).mock.calls[0];

      expect(blob).toBeInstanceOf(Blob);
      expect(fileName).toBe("School_Exam_Timetables_A4.xlsx");
      expect(extension).toBe("xlsx");
    }, 30000);

    it("should successfully generate and save Excel file for invigilators", async () => {
      await exportInvigilatorsToExcel(baseTestData);

      expect(FileService.saveExport).toHaveBeenCalledTimes(1);
      const [blob, fileName, extension] = vi.mocked(FileService.saveExport).mock.calls[0];

      expect(blob).toBeInstanceOf(Blob);
      expect(fileName).toBe("Invigilation_Master_Roster_A3.xlsx");
      expect(extension).toBe("xlsx");
    }, 30000);

    it("should open print window and write HTML for PDF exam export", () => {
      vi.useFakeTimers();
      exportExamsToPDF(baseTestData);

      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      expect(mockDocumentWrite).toHaveBeenCalledTimes(1);

      const htmlContent = mockDocumentWrite.mock.calls[0][0];
      expect(htmlContent).toContain("Test School");
      expect(htmlContent).toContain("Class 10A");
      expect(htmlContent).toContain("Math");

      vi.runAllTimers();
      expect(mockPrint).toHaveBeenCalledTimes(1);
    });

    it("should open print window and write HTML for PDF invigilator export", () => {
      vi.useFakeTimers();
      exportInvigilatorsToPDF(baseTestData);

      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      expect(mockDocumentWrite).toHaveBeenCalledTimes(1);

      const htmlContent = mockDocumentWrite.mock.calls[0][0];
      expect(htmlContent).toContain("Invigilation Master Roster");
      expect(htmlContent).toContain("Class 10A");
      expect(htmlContent).toContain("Teacher One");

      vi.runAllTimers();
      expect(mockPrint).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------
  // print-export.test.ts tests
  // ----------------------------------------------------
  describe("Schedule Print Export", () => {
    it("should open print window and write HTML for CLASS mode", () => {
      vi.useFakeTimers();
      printAllSchedules(baseTestData, "CLASS");

      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      expect(mockDocumentWrite).toHaveBeenCalledTimes(1);

      const htmlContent = mockDocumentWrite.mock.calls[0][0];
      expect(htmlContent).toContain("Test School");
      expect(htmlContent).toContain("Class 10A");
      expect(htmlContent).toContain("Math");

      vi.runAllTimers();
      expect(mockPrint).toHaveBeenCalledTimes(1);
    });

    it("should open print window and write HTML for TEACHER mode", () => {
      vi.useFakeTimers();
      printAllSchedules(baseTestData, "TEACHER");

      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      expect(mockDocumentWrite).toHaveBeenCalledTimes(1);

      const htmlContent = mockDocumentWrite.mock.calls[0][0];
      expect(htmlContent).toContain("Teacher One");
      expect(htmlContent).toContain("Math");

      vi.runAllTimers();
      expect(mockPrint).toHaveBeenCalledTimes(1);
    });
  });
});
