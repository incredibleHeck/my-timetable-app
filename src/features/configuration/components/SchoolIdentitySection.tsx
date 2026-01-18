import React from "react";
import { GraduationCap } from "lucide-react";
import { Card, Input } from "../../../components/ui";
import { AppData } from "../../../types";

interface SchoolIdentitySectionProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  addActivity: (type: "SCHEDULING" | "ACADEMIC" | "SYSTEM", message: string, nextData?: AppData) => void;
}

export const SchoolIdentitySection: React.FC<SchoolIdentitySectionProps> = ({
  data,
  onUpdate,
  addActivity,
}) => {
  return (
    <Card className="p-6 border-l-4 border-l-slate-800 bg-white">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap className="text-slate-800" size={24} /> School Identity
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            This information will appear on all printed schedules and reports.
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-auto flex-1 max-w-xl">
          <div className="flex-1">
            <Input
              label="Institution Name"
              placeholder="e.g. St. Mary's High School"
              value={data.settings.schoolName || ""}
              onChange={(e) => {
                const nextData = {
                  ...data,
                  settings: { ...data.settings, schoolName: e.target.value },
                };
                addActivity("SYSTEM", `Updated School Name: ${e.target.value}`, nextData);
                onUpdate(nextData);
              }}
            />
          </div>
          <div className="w-40">
            <Input
              label="Academic Term"
              placeholder="e.g. 2024-2025"
              value={data.settings.academicYear || ""}
              onChange={(e) => {
                const nextData = {
                  ...data,
                  settings: { ...data.settings, academicYear: e.target.value },
                };
                addActivity("SYSTEM", `Updated Academic Year: ${e.target.value}`, nextData);
                onUpdate(nextData);
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
