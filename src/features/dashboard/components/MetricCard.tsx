import React from "react";
import { Card } from "../../../components/ui";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "emerald" | "violet" | "amber";
  subtext: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  color,
  subtext,
}) => {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };

  return (
    <Card className="p-5 hover:shadow-lg transition-shadow border-slate-100">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>{icon}</div>
      </div>
      <h3 className="text-3xl font-bold text-slate-800 mb-1">{value}</h3>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
        {subtext}
      </p>
    </Card>
  );
};
