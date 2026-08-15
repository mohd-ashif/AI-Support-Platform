import React from "react";
import { CheckCircle2, Clock, XCircle, AlertCircle, Sparkles } from "lucide-react";

export type StatusType =
  | "completed"
  | "active"
  | "ready"
  | "pending"
  | "crawling"
  | "processing"
  | "trialing"
  | "failed"
  | "canceled"
  | string;

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
  title?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = "", title }) => {
  const norm = (status || "").toLowerCase();

  if (norm === "completed" || norm === "active" || norm === "ready") {
    return (
      <span
        title={title}
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}
      >
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        <span className="capitalize">{label || norm}</span>
      </span>
    );
  }

  if (norm === "pending" || norm === "crawling" || norm === "processing" || norm === "trialing") {
    return (
      <span
        title={title}
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}
      >
        <Clock className="h-3 w-3 shrink-0 animate-spin" />
        <span className="capitalize">{label || norm}</span>
      </span>
    );
  }

  if (norm === "failed" || norm === "canceled") {
    return (
      <span
        title={title}
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 ${className}`}
      >
        <XCircle className="h-3 w-3 shrink-0" />
        <span className="capitalize">{label || norm}</span>
      </span>
    );
  }

  return (
    <span
      title={title}
      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700 ${className}`}
    >
      <AlertCircle className="h-3 w-3 shrink-0 text-neutral-400" />
      <span className="capitalize">{label || norm}</span>
    </span>
  );
};
