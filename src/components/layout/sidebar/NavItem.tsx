import React from "react";
import { ViewState } from "../../../types";

export const NavItem = ({
  id,
  icon,
  label,
  currentView,
  onClick,
  badge,
  badgeVariant = "default",
}: {
  id: ViewState;
  icon: React.ReactNode;
  label: string;
  currentView: ViewState;
  onClick: (v: ViewState) => void;
  badge?: number | string;
  badgeVariant?: "default" | "danger";
}) => (
  <button
    onClick={() => onClick(id)}
    aria-current={currentView === id ? "page" : undefined}
    className={`w-full flex items-center px-6 py-3 transition-colors border-l-4 text-sm font-medium group ${
      currentView === id
        ? "bg-slate-800 text-white border-amber-400"
        : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50"
    }`}
  >
    <span
      className={`mr-3 transition-transform ${
        currentView === id ? "scale-110 text-amber-400" : "group-hover:scale-110"
      }`}
    >
      {icon}
    </span>
    <span className="flex-1 text-left">{label}</span>
    {badge !== undefined && badge !== 0 && (
      <span
        className={`ml-auto text-2xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
          badgeVariant === "danger" ? "bg-red-500 text-white" : "bg-slate-700 text-slate-300"
        }`}
      >
        {badge}
      </span>
    )}
  </button>
);
