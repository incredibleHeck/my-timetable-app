import React from "react";

interface ConfigPageHeaderProps {
  profileName?: string;
}

export const ConfigPageHeader: React.FC<ConfigPageHeaderProps> = ({ profileName }) => (
  <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-content">Configuration</h2>
      <p className="mt-1 max-w-prose text-xs leading-relaxed text-content-muted">
        School-wide defaults for the generator, workload analysis and exports. Changes apply
        immediately and can be undone.
      </p>
    </div>
    {profileName && (
      <p className="text-xs text-content-muted">
        Profile <span className="font-medium text-content-secondary">{profileName}</span>
      </p>
    )}
  </header>
);
