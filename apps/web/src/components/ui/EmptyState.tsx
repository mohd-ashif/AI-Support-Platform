import React from "react";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = FolderOpen,
  title,
  description,
  action,
  className = "",
}) => {
  return (
    <div className={`py-12 px-4 text-center space-y-3 flex flex-col items-center justify-center ${className}`}>
      <div className="h-12 w-12 rounded-2xl bg-[#161616] border border-[#262626] flex items-center justify-center text-[#D4AF37] shadow-inner">
        <Icon className="h-6 w-6 stroke-[1.5]" />
      </div>
      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-bold text-neutral-200">{title}</h4>
        <p className="text-xs text-neutral-400 leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
