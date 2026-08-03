import React, { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { Card, Input } from "../../../components/ui";
import { AppData } from "../../../types";
import { ConfigCommitFn } from "../hooks/useConfigCommit";

interface SchoolIdentitySectionProps {
  data: AppData;
  commit: ConfigCommitFn;
  handleIdentityUpdate: (field: "schoolName" | "academicYear", val: string) => AppData;
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

  const commitField = (field: "schoolName" | "academicYear", val: string, label: string) => {
    const stored = data.settings[field] || "";
    if (val === stored) return;
    const nextData = handleIdentityUpdate(field, val);
    commit(`Updated ${label}: ${val}`, nextData);
  };

  return (
    <Card className="p-6 border-l-4 border-l-slate-800 bg-white dark:bg-slate-800">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <GraduationCap className="text-slate-800 dark:text-slate-100" size={24} aria-hidden />{" "}
            School Identity
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Appears on printed schedules and reports. Changes save when you leave each field.
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-auto flex-1 max-w-xl">
          <div className="flex-1">
            <Input
              label="Institution Name"
              placeholder="e.g. St. Mary's High School"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              onBlur={() => commitField("schoolName", schoolName, "School Name")}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </div>
          <div className="w-40">
            <Input
              label="Academic Term"
              placeholder="e.g. 2024-2025"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              onBlur={() => commitField("academicYear", academicYear, "Academic Year")}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
