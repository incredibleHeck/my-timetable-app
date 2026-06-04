import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useExamRosters } from "../src/features/exams/hooks/useExamRosters";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData, ExamRoster } from "../src/types";

describe("useExamRosters", () => {
  it("should initialize with a default exam roster if none exists", () => {
    const mockOnUpdate = vi.fn();
    const data: AppData = { ...DEFAULT_DATA, examRosters: [], exams: [] };

    const { result } = renderHook(() => useExamRosters(data, mockOnUpdate));

    expect(mockOnUpdate).toHaveBeenCalled();
    const updateCall = mockOnUpdate.mock.calls[0][0] as AppData;
    expect(updateCall.examRosters?.length).toBe(1);
    expect(updateCall.examRosters?.[0].name).toBe("Standard Timetable");

    expect(result.current.activeRosterId).toBe(updateCall.examRosters?.[0].id);
  });

  it("should migrate legacy exams array to an imported roster", () => {
    const mockOnUpdate = vi.fn();
    const data: AppData = { ...DEFAULT_DATA, examRosters: [], exams: [{ id: "e1", classId: "c1", subjectId: "s1", date: "2024-01-01", duration: 120, mode: "WRITTEN", invigilators: [] }] };

    const { result } = renderHook(() => useExamRosters(data, mockOnUpdate));

    expect(mockOnUpdate).toHaveBeenCalled();
    const updateCall = mockOnUpdate.mock.calls[0][0] as AppData;
    expect(updateCall.examRosters?.length).toBe(1);
    expect(updateCall.examRosters?.[0].name).toBe("Imported Timetable");
    expect(updateCall.examRosters?.[0].exams.length).toBe(1);
    expect(updateCall.exams.length).toBe(0); // Legacy exams cleared
  });

  it("should hydrate with existing rosters", () => {
    const mockOnUpdate = vi.fn();
    const existingRoster: ExamRoster = {
      id: "r1",
      name: "Existing Roster",
      exams: [],
      createdAt: new Date().toISOString(),
    };
    const data: AppData = { ...DEFAULT_DATA, examRosters: [existingRoster] };

    const { result } = renderHook(() => useExamRosters(data, mockOnUpdate));

    expect(result.current.activeRosterId).toBe("r1");
    expect(result.current.activeRoster).toEqual(existingRoster);
    expect(mockOnUpdate).not.toHaveBeenCalled(); 
  });

  it("should create a new roster", () => {
    const mockOnUpdate = vi.fn();
    const data: AppData = { ...DEFAULT_DATA, examRosters: [] };
    const { result } = renderHook(() => useExamRosters(data, mockOnUpdate));

    act(() => {
      result.current.createNewRoster();
    });

    expect(mockOnUpdate).toHaveBeenCalledTimes(2); // 1st: default init, 2nd: createNewRoster
    const updateCall = mockOnUpdate.mock.calls[1][0] as AppData;
    expect(updateCall.examRosters?.length).toBe(1);
    expect(updateCall.examRosters?.[0].name).toMatch(/New Timetable/);
  });

  it("should update exams in active roster via handleUpdateActiveRoster", () => {
    const mockOnUpdate = vi.fn();
    const existingRoster: ExamRoster = {
      id: "r1",
      name: "Existing Roster",
      exams: [],
      createdAt: new Date().toISOString(),
    };
    const data: AppData = { ...DEFAULT_DATA, examRosters: [existingRoster] };

    const { result } = renderHook(() => useExamRosters(data, mockOnUpdate));

    act(() => {
      result.current.handleUpdateActiveRoster({ ...data, exams: [{ id: "e1", classId: "c1", subjectId: "s1", date: "2024-01-01", duration: 120, mode: "WRITTEN", invigilators: [] }] });
    });

    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockOnUpdate.mock.calls[0][0] as AppData;
    expect(updateCall.examRosters?.[0].exams.length).toBe(1);
    expect(updateCall.exams.length).toBe(0); 
  });

  it("should rename a roster", () => {
    const mockOnUpdate = vi.fn();
    const existingRoster: ExamRoster = {
      id: "r1",
      name: "Existing Roster",
      exams: [],
      createdAt: new Date().toISOString(),
    };
    const data: AppData = { ...DEFAULT_DATA, examRosters: [existingRoster] };

    const { result } = renderHook(() => useExamRosters(data, mockOnUpdate));

    act(() => {
      result.current.renameRoster("Renamed Roster");
    });

    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockOnUpdate.mock.calls[0][0] as AppData;
    expect(updateCall.examRosters?.[0].name).toBe("Renamed Roster");
  });

  it("should delete a roster", () => {
    const mockOnUpdate = vi.fn();
    const existingRoster: ExamRoster = {
      id: "r1",
      name: "Existing Roster",
      exams: [],
      createdAt: new Date().toISOString(),
    };
    const data: AppData = { ...DEFAULT_DATA, examRosters: [existingRoster] };

    window.confirm = vi.fn(() => true);

    const { result } = renderHook(() => useExamRosters(data, mockOnUpdate));

    act(() => {
      result.current.deleteRoster("r1");
    });

    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockOnUpdate.mock.calls[0][0] as AppData;
    expect(updateCall.examRosters?.length).toBe(0);
  });
});
