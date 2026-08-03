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
    className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-amber-400 hover:shadow-md transition-all text-left group w-full"
  >
    <div className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-lg group-hover:bg-amber-50 dark:group-hover:bg-amber-900/30 group-hover:text-accent-ink transition-colors">
      {icon}
    </div>
    <div className="flex-1">
      <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-amber-800 dark:group-hover:text-amber-200 transition-colors">
        {label}
      </h4>
      <p className="text-xs text-content-muted">{desc}</p>
    </div>
    <div className="text-slate-300 group-hover:text-accent-ink transition-colors">
      <ArrowRight size={16} />
    </div>
  </button>
);
