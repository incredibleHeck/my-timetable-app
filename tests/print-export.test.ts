import { describe, it, expect, vi, beforeEach } from "vitest";
import { printAllSchedules } from "../src/services/export/print";
import { AppData } from "../src/types";

describe("Print Export Services", () => {
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
    vi.useFakeTimers();
  });

  const testData = {
    settings: {
      schoolName: "Test School",
      periodsPerDay: 8,
      dayStructure: Array(8).fill({ type: "CLASS", label: "P" }),
      timeSlots: Array(8).fill({ start: "08:00", end: "09:00" }),
    },
    subjects: [{ id: "s1", name: "Math", color: "#FF0000" }],
    teachers: [{ id: "t1", name: "Teacher One" }],
    classes: [{ id: "c1", name: "Class 10A" }],
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
  } as unknown as AppData;

  it("should open print window and write HTML for CLASS mode", () => {
    printAllSchedules(testData, "CLASS");

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
    printAllSchedules(testData, "TEACHER");

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockDocumentWrite).toHaveBeenCalledTimes(1);
    
    const htmlContent = mockDocumentWrite.mock.calls[0][0];
    expect(htmlContent).toContain("Teacher One");
    expect(htmlContent).toContain("Math");

    vi.runAllTimers();
    expect(mockPrint).toHaveBeenCalledTimes(1);
  });
});
