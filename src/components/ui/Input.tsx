import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = "",
  ...props
}) => (
  <div className="w-full">
    {label && (
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
    )}
    <input
      className={`w-full px-4 py-2.5 bg-white border ${
        error
          ? "border-red-300 focus:ring-red-200"
          : "border-slate-200 focus:ring-slate-200"
      } rounded-xl text-slate-800 focus:outline-none focus:ring-4 transition-all placeholder:text-slate-300 ${className}`}
      {...props}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);
