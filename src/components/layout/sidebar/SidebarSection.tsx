import React from "react";

export const SidebarSection = ({
  label,
  isFirst = false,
}: {
  label: string;
  isFirst?: boolean;
}) => (
  <div
    className={`px-6 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest ${
      !isFirst ? "mt-4" : ""
    }`}
  >
    {label.toUpperCase()}
  </div>
);
