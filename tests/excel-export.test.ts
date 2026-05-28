import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportScheduleToExcel } from "../src/services/export/excel";
import { FileService } from "../src/services/fileSystem";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";

// Mock FileService
vi.mock("../src/services/fileSystem", () => ({
  FileService: {
    saveExport: vi.fn().mockResolvedValue({ success: true, path: "/mock/save/path.xlsx" }),
  },
}));

describe("Excel Export Services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const testData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      schoolName: "Test School",
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
        name: "10A",
        defaultRoomId: "r1",
        curriculum: [{ id: "curr1", subjectId: "s1", singles: 4, doubles: 0, assignedTeacherId: "t1", periodsPerWeek: 4 }],
      },
    ],
    schedule: {
      c1: {
        // day index 0 = Monday, period index 0 = P1
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
    conflicts: [],
  };

  it("should successfully generate and save Excel file for CLASS mode", async () => {
    await exportScheduleToExcel(testData, "CLASS");

    expect(FileService.saveExport).toHaveBeenCalledTimes(1);
    const [blob, fileName, extension] = vi.mocked(FileService.saveExport).mock.calls[0];

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(fileName).toBe("Full_Classes_Schedule.xlsx");
    expect(extension).toBe("xlsx");
  });

  it("should successfully generate and save Excel file for TEACHER mode", async () => {
    await exportScheduleToExcel(testData, "TEACHER");

    expect(FileService.saveExport).toHaveBeenCalledTimes(1);
    const [blob, fileName, extension] = vi.mocked(FileService.saveExport).mock.calls[0];

    expect(blob).toBeInstanceOf(Blob);
    expect(fileName).toBe("Full_Faculty_Schedule.xlsx");
    expect(extension).toBe("xlsx");
  });

  it("should warn and exit if no entities are available to export", async () => {
    const emptyData: AppData = {
      ...testData,
      classes: [],
      teachers: [],
    };

    await exportScheduleToExcel(emptyData, "CLASS");
    expect(FileService.saveExport).not.toHaveBeenCalled();
  });
});
