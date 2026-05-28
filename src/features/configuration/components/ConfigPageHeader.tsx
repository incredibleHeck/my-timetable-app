import React from "react";
import { Sliders } from "lucide-react";

interface ConfigPageHeaderProps {
  profileName?: string;
}

export const ConfigPageHeader: React.FC<ConfigPageHeaderProps> = ({
  profileName,
}) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Sliders className="text-amber-500" size={22} aria-hidden />
        Configuration
      </h2>
      <p className="text-xs text-slate-500 mt-1">
        School-wide defaults for the generator, workload analysis, and exports.
      </p>
      {profileName && (
        <p className="text-xs text-slate-400 mt-1">
          Active profile: <span className="font-bold text-slate-600">{profileName}</span>
        </p>
      )}
    </div>
  </div>
);
