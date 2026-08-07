import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportWorkloadToExcel } from "../src/services/export/workload";
import { WorkloadStat } from "../src/features/workload/hooks/useWorkloadStats";

/**
 * Recording stand-ins for the ExcelJS objects the exporter touches. The point is
 * to capture what was written — columns, row values, number formats, colours —
 * so a change to the sheet's shape fails a test. A mock that discards its input
 * only proves the function did not throw.
 */
interface RecordedCell {
  numFmt?: string;
  font?: { color?: { argb?: string }; bold?: boolean };
  alignment?: { horizontal?: string };
  border?: unknown;
}

class RecordedSheet {
  name: string;
  columns: { header: string; key: string; width: number }[] = [];
  rows: Record<string, unknown>[] = [];
  cells: Record<string, RecordedCell>[] = [];
  headerRow: RecordedCell & { fill?: { fgColor?: { argb?: string } } } = {};

  constructor(name: string) {
    this.name = name;
  }

  getRow(n: number) {
    return n === 1 ? this.headerRow : {};
  }

  addRow(values: Record<string, unknown>) {
    this.rows.push(values);
    const cellsForRow: Record<string, RecordedCell> = {};
    this.cells.push(cellsForRow);
    return {
      getCell: (key: string) => (cellsForRow[key] ??= {}),
    };
  }

  eachRow(fn: (row: { eachCell: (cb: (cell: RecordedCell) => void) => void }) => void) {
    fn({ eachCell: (cb) => cb({}) });
  }
}

const sheets: RecordedSheet[] = [];
let writtenBuffer: Uint8Array | null = null;

vi.mock("../src/services/export/excelLoader", () => ({
  loadExcelJS: async () => ({
    Workbook: class {
      creator = "";
      created: Date | null = null;
      addWorksheet(name: string) {
        const s = new RecordedSheet(name);
        sheets.push(s);
        return s;
      }
      xlsx = {
        writeBuffer: async () => {
          writtenBuffer = new Uint8Array([1, 2, 3]);
          return writtenBuffer;
        },
      };
    },
  }),
}));

const savedExports: { name: string; ext: string }[] = [];
vi.mock("../src/services/fileSystem", () => ({
  FileService: {
    saveExport: async (_blob: Blob, name: string, ext: string) => {
      savedExports.push({ name, ext });
      return { success: true };
    },
  },
}));

const stat = (overrides: { name: string; utilizationPct: number } & Record<string, unknown>) =>
  ({
    t: { id: overrides.name, name: overrides.name, specialtyIds: [], constraints: [] },
    requestedPeriods: 10,
    assignedPeriods: 8,
    scheduledPeriods: 7,
    blockedSlots: 2,
    maxWeeklyPeriods: 20,
    maxWeeklyCapacity: 20,
    classDistribution: {},
    ...overrides,
  }) as unknown as WorkloadStat;

describe("exportWorkloadToExcel", () => {
  beforeEach(() => {
    sheets.length = 0;
    savedExports.length = 0;
    writtenBuffer = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("writes a Faculty Workload sheet with the expected column order", async () => {
    await exportWorkloadToExcel([stat({ name: "Alice", utilizationPct: 40 })], vi.fn());

    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("Faculty Workload");
    expect(sheets[0].columns.map((c) => c.header)).toEqual([
      "Teacher Name",
      "Requested Periods",
      "Scheduled Periods",
      "Blocked Slots",
      "Max Weekly Periods",
      "Utilization %",
    ]);
    expect(sheets[0].columns.map((c) => c.key)).toEqual([
      "name",
      "requested",
      "scheduled",
      "blocked",
      "max",
      "utilization",
    ]);
  });

  it("maps each stat onto the row fields the columns declare", async () => {
    await exportWorkloadToExcel(
      [
        stat({
          name: "Bob",
          assignedPeriods: 12,
          scheduledPeriods: 11,
          blockedSlots: 3,
          maxWeeklyCapacity: 24,
          utilizationPct: 50,
        }),
      ],
      vi.fn(),
    );

    expect(sheets[0].rows).toEqual([
      {
        name: "Bob",
        requested: 12,
        scheduled: 11,
        blocked: 3,
        max: 24,
        // Excel stores percentages as fractions, so 50% must be written as 0.5.
        utilization: 0.5,
      },
    ]);
  });

  it("writes one row per teacher, in order", async () => {
    await exportWorkloadToExcel(
      [
        stat({ name: "Alice", utilizationPct: 10 }),
        stat({ name: "Bob", utilizationPct: 20 }),
        stat({ name: "Cara", utilizationPct: 30 }),
      ],
      vi.fn(),
    );

    expect(sheets[0].rows.map((r) => r.name)).toEqual(["Alice", "Bob", "Cara"]);
  });

  it("formats utilisation as a percentage and colours it by band", async () => {
    await exportWorkloadToExcel(
      [
        stat({ name: "Under", utilizationPct: 50 }), // emerald
        stat({ name: "Near", utilizationPct: 90 }), // amber, >85
        stat({ name: "Over", utilizationPct: 120 }), // red, >100
      ],
      vi.fn(),
    );

    const util = sheets[0].cells.map((c) => c.utilization);
    expect(util.map((c) => c.numFmt)).toEqual(["0.0%", "0.0%", "0.0%"]);
    expect(util[0].font?.color?.argb).toBe("FF059669");
    expect(util[1].font?.color?.argb).toBe("FFD97706");
    expect(util[2].font?.color?.argb).toBe("FFDC2626");
    expect(util[1].font?.bold).toBe(true);
    expect(util[2].font?.bold).toBe(true);
  });

  it("treats exactly 85% and exactly 100% as the lower band", async () => {
    // The thresholds are strict >, so the boundaries must not tip over.
    await exportWorkloadToExcel(
      [stat({ name: "At85", utilizationPct: 85 }), stat({ name: "At100", utilizationPct: 100 })],
      vi.fn(),
    );

    const util = sheets[0].cells.map((c) => c.utilization);
    expect(util[0].font?.color?.argb).toBe("FF059669");
    expect(util[1].font?.color?.argb).toBe("FFD97706");
  });

  it("centres the numeric columns", async () => {
    await exportWorkloadToExcel([stat({ name: "Alice", utilizationPct: 40 })], vi.fn());

    const cells = sheets[0].cells[0];
    for (const key of ["requested", "scheduled", "blocked", "max", "utilization"]) {
      expect(cells[key].alignment).toEqual({ horizontal: "center" });
    }
  });

  it("saves under the expected filename and reports success", async () => {
    const notify = vi.fn();
    await exportWorkloadToExcel([stat({ name: "Alice", utilizationPct: 40 })], notify);

    expect(savedExports).toEqual([{ name: "Faculty_Workload_Report.xlsx", ext: "xlsx" }]);
    expect(writtenBuffer).not.toBeNull();
    expect(notify).toHaveBeenCalledWith(
      "Workload report exported to Excel successfully.",
      "success",
    );
  });

  it("produces a header-only sheet when there are no teachers", async () => {
    await exportWorkloadToExcel([], vi.fn());

    expect(sheets[0].columns).toHaveLength(6);
    expect(sheets[0].rows).toEqual([]);
    expect(savedExports).toHaveLength(1);
  });

  it("reports failure instead of throwing when the workbook cannot be written", async () => {
    const notify = vi.fn();
    // A stat with no teacher record makes the row mapping throw.
    await exportWorkloadToExcel([{} as WorkloadStat], notify);

    expect(notify).toHaveBeenCalledWith("Failed to export workload report.", "error");
  });
});
