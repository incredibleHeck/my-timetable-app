import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportDutyToExcel, printDutyRoster } from "../src/services/export/duty";
import { FileService } from "../src/services/fileSystem";
import { AppData, DutyRoster } from "../src/types";

// Mock FileService
vi.mock("../src/services/fileSystem", () => ({
  FileService: {
    saveExport: vi.fn().mockResolvedValue({ success: true, path: "/mock/save/path.xlsx" }),
  },
}));

describe("Duty Export Services", () => {
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
    teachers: [{ id: "t1", name: "Teacher One" }],
  } as unknown as AppData;

  const testRoster: DutyRoster = {
    id: "r1",
    name: "Morning Duty",
    type: "DAILY",
    dailyParams: { max: 2 },
    weeklyParams: { weeks: 1, max: 2 },
    dailyAssignments: [{ day: 0, period: 0, teacherId: "t1" }],
    weeklyAssignments: [],
  };

  it("should successfully generate and save Excel file for duty roster", async () => {
    await exportDutyToExcel(testData, testRoster);

    expect(FileService.saveExport).toHaveBeenCalledTimes(1);
    const [blob, fileName, extension] = vi.mocked(FileService.saveExport).mock.calls[0];

    expect(blob).toBeInstanceOf(Blob);
    expect(fileName).toBe("Morning_Duty_Export.xlsx");
    expect(extension).toBe("xlsx");
  }, 10000);

  it("should open print window and write HTML for duty roster", () => {
    vi.useFakeTimers();
    printDutyRoster(testData, testRoster);

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockDocumentWrite).toHaveBeenCalledTimes(1);
    
    const htmlContent = mockDocumentWrite.mock.calls[0][0];
    expect(htmlContent).toContain("Morning Duty");
    expect(htmlContent).toContain("Teacher One");

    vi.runAllTimers();
    expect(mockPrint).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
