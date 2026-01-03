import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  icon,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantStyles = {
    primary:
      "bg-slate-800 text-amber-400 border border-slate-700 hover:bg-slate-700 hover:text-amber-300 shadow-sm hover:shadow-md active:scale-95",
    secondary:
      "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:text-slate-800 active:scale-95",
    danger:
      "bg-red-500 text-white border border-red-600 hover:bg-red-600 shadow-sm hover:shadow-md active:scale-95",
    ghost:
      "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="flex items-center justify-center">{icon}</span>}
      {children}
    </button>
  );
};
