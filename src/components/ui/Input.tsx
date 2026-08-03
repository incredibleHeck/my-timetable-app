import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = "", id, ...props }) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-4 py-2.5 bg-white dark:bg-slate-800 border ${
          error
            ? "border-red-300 focus:ring-red-200"
            : "border-slate-200 dark:border-slate-700 focus:ring-slate-200"
        } rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-4 transition-all placeholder:text-slate-300 ${className}`}
        {...props}
      />
      {error && <p className="text-danger-ink text-xs mt-1">{error}</p>}
    </div>
  );
};
