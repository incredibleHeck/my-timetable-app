import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  exportExamsToExcel,
  exportExamsToPDF,
  exportInvigilatorsToExcel,
  exportInvigilatorsToPDF,
} from "../src/services/export/exams";
import { FileService } from "../src/services/fileSystem";
import { AppData } from "../src/types";

vi.mock("../src/services/fileSystem", () => ({
  FileService: {
    saveExport: vi.fn().mockResolvedValue({ success: true, path: "/mock/save/path.xlsx" }),
  },
}));

describe("Exams Export Services", () => {
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

  const testData = {
    settings: {
      schoolName: "Test School",
      academicYear: "2026",
    },
    subjects: [{ id: "s1", name: "Math", color: "#FF0000" }],
    teachers: [{ id: "t1", name: "Teacher One" }],
    classes: [{ id: "c1", name: "Class 10A" }],
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
  } as unknown as AppData;

  it("should successfully generate and save Excel file for exams", async () => {
    await exportExamsToExcel(testData);

    expect(FileService.saveExport).toHaveBeenCalledTimes(1);
    const [blob, fileName, extension] = vi.mocked(FileService.saveExport).mock.calls[0];

    expect(blob).toBeInstanceOf(Blob);
    expect(fileName).toBe("School_Exam_Timetables_A4.xlsx");
    expect(extension).toBe("xlsx");
  }, 10000);

  it("should successfully generate and save Excel file for invigilators", async () => {
    await exportInvigilatorsToExcel(testData);

    expect(FileService.saveExport).toHaveBeenCalledTimes(1);
    const [blob, fileName, extension] = vi.mocked(FileService.saveExport).mock.calls[0];

    expect(blob).toBeInstanceOf(Blob);
    expect(fileName).toBe("Invigilation_Master_Roster_A3.xlsx");
    expect(extension).toBe("xlsx");
  }, 10000);

  it("should open print window and write HTML for PDF exam export", () => {
    vi.useFakeTimers();
    exportExamsToPDF(testData);

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockDocumentWrite).toHaveBeenCalledTimes(1);
    
    const htmlContent = mockDocumentWrite.mock.calls[0][0];
    expect(htmlContent).toContain("Test School");
    expect(htmlContent).toContain("Class 10A");
    expect(htmlContent).toContain("Math");

    vi.runAllTimers();
    expect(mockPrint).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("should open print window and write HTML for PDF invigilator export", () => {
    vi.useFakeTimers();
    exportInvigilatorsToPDF(testData);

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockDocumentWrite).toHaveBeenCalledTimes(1);
    
    const htmlContent = mockDocumentWrite.mock.calls[0][0];
    expect(htmlContent).toContain("Invigilation Master Roster");
    expect(htmlContent).toContain("Class 10A");
    expect(htmlContent).toContain("Teacher One");

    vi.runAllTimers();
    expect(mockPrint).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
