import React from "react";
import { AlertCircle } from "lucide-react";

interface FormFieldProps {
  label?: string;
  error?: string | null;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  required = false,
  children,
  className = "",
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-neutral-300">
          {label}
          {required && <span className="text-[#D4AF37] ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-[11px] text-red-400 font-medium flex items-center space-x-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {!error && helperText && <p className="text-[11px] text-neutral-500">{helperText}</p>}
    </div>
  );
};
