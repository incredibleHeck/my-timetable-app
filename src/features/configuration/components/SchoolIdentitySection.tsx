import React, { useEffect, useState } from "react";
import { AppData } from "../../../types";
import { ConfigCommitFn } from "../hooks/useConfigCommit";
import { ConfigPanel, SettingRow, SettingRows, controlClass } from "./ConfigPanel";

type IdentityField = "schoolName" | "academicYear";

interface SchoolIdentitySectionProps {
  data: AppData;
  commit: ConfigCommitFn;
  handleIdentityUpdate: (field: IdentityField, val: string) => AppData;
}

export const SchoolIdentitySection: React.FC<SchoolIdentitySectionProps> = ({
  data,
  commit,
  handleIdentityUpdate,
}) => {
  const [schoolName, setSchoolName] = useState(data.settings.schoolName || "");
  const [academicYear, setAcademicYear] = useState(data.settings.academicYear || "");

  useEffect(() => {
    setSchoolName(data.settings.schoolName || "");
    setAcademicYear(data.settings.academicYear || "");
  }, [data.settings.schoolName, data.settings.academicYear]);

  const commitField = (field: IdentityField, val: string, label: string) => {
    const stored = data.settings[field] || "";
    if (val === stored) return;
    commit(`Updated ${label}: ${val}`, handleIdentityUpdate(field, val));
  };

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  };

  return (
    <ConfigPanel
      title="School identity"
      description="Printed on exported timetables, rosters and reports. Each field saves when you leave it."
    >
      <SettingRows>
        <SettingRow
          title="School name"
          htmlFor="school-name"
          control={
            <input
              id="school-name"
              className={`${controlClass} w-64 max-w-full`}
              placeholder="St. Mary's High School"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              onBlur={() => commitField("schoolName", schoolName, "School Name")}
              onKeyDown={blurOnEnter}
            />
          }
        />
        <SettingRow
          title="Academic year"
          description="Shown alongside the school name in report headers."
          htmlFor="academic-year"
          control={
            <input
              id="academic-year"
              className={`${controlClass} w-36`}
              placeholder="2025-2026"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              onBlur={() => commitField("academicYear", academicYear, "Academic Year")}
              onKeyDown={blurOnEnter}
            />
          }
        />
      </SettingRows>
    </ConfigPanel>
  );
};
