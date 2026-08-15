import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-400 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />;
      case "info":
      default:
        return <Info className="h-5 w-5 text-[#D4AF37] shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case "success":
        return "border-emerald-500/30 bg-[#0A120D]";
      case "error":
        return "border-red-500/30 bg-[#140A0A]";
      case "warning":
        return "border-amber-500/30 bg-[#14100A]";
      case "info":
      default:
        return "border-[#D4AF37]/30 bg-[#12110A]";
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start justify-between space-x-3 p-4 rounded-xl border ${getBorderColor()} text-white shadow-2xl backdrop-blur-md max-w-sm w-full transition-all duration-200 animate-in slide-in-from-top-2 fade-in`}
    >
      <div className="flex items-start space-x-3">
        {getIcon()}
        <div className="space-y-0.5">
          {toast.title && <h4 className="text-xs font-bold text-neutral-200">{toast.title}</h4>}
          <p className="text-xs text-neutral-300 leading-relaxed">{toast.message}</p>
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        title="Dismiss Notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
