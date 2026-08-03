import React from "react";

interface NumberStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  helpText?: string;
  onChange: (value: number) => void;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  label,
  value,
  min,
  max,
  helpText,
  onChange,
}) => {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="space-y-2">
      <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{label}</h4>
      {helpText && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          {helpText}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="w-8 h-8 rounded bg-white dark:bg-slate-800 border border-slate-300 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          -
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            if (!Number.isNaN(parsed)) onChange(clamp(parsed));
          }}
          className="w-14 text-center text-lg font-bold text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 focus:border-amber-500 outline-none"
          aria-label={label}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="w-8 h-8 rounded bg-white dark:bg-slate-800 border border-slate-300 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
    </div>
  );
};
