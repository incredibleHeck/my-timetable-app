import React from "react";
import { ArrowRight } from "lucide-react";

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick?: () => void;
}

export const QuickAction: React.FC<QuickActionProps> = ({ icon, label, desc, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-400 hover:shadow-md transition-all text-left group w-full"
  >
    <div className="p-3 bg-slate-50 text-slate-600 rounded-lg group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
      {icon}
    </div>
    <div className="flex-1">
      <h4 className="font-bold text-slate-700 text-sm group-hover:text-amber-700 transition-colors">
        {label}
      </h4>
      <p className="text-xs text-slate-400">{desc}</p>
    </div>
    <div className="text-slate-300 group-hover:text-amber-500 transition-colors">
      <ArrowRight size={16} />
    </div>
  </button>
);
