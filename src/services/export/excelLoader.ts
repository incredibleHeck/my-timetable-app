import type ExcelJS from "exceljs";

let excelPromise: Promise<typeof ExcelJS> | null = null;

export const loadExcelJS = async (): Promise<typeof ExcelJS> => {
  if (!excelPromise) {
    excelPromise = import("exceljs").then((mod) => mod.default);
  }
  return excelPromise;
};
