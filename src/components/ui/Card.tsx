import React from "react";

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = "", onClick }) => (
  <div
    className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}
    onClick={onClick}
  >
    {children}
  </div>
);
