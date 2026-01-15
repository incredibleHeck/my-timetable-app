import { AppData } from "../types"; // UPDATED IMPORT

// Utility for safe ID generation
export const generateId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return (
    "id-" +
    Math.random().toString(36).substring(2, 9) +
    "-" +
    Date.now().toString(36)
  );
};

// Faster & Safer Deep Clone (Generic)
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepClone) as any;
  }
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
};

// Download Helper
export const triggerDownload = (data: any, filename: string) => {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// CSV Export Helper
export const exportToCSV = (
  headers: string[],
  rows: (string | number)[],
  filename: string
) => {
  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((e) => String(e))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Merges loaded app data with defaults to ensure schema consistency
 */
export const mergeWithDefaults = (loadedData: AppData, defaults: AppData): AppData => {
  return {
    ...defaults,
    ...loadedData,
    settings: {
      ...defaults.settings,
      ...loadedData.settings,
    }
  };
};
