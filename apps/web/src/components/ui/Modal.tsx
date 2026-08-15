import React, { useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ElementType;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon: Icon = AlertTriangle,
  children,
  footer,
  maxWidth = "sm",
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClass =
    maxWidth === "sm"
      ? "max-w-sm"
      : maxWidth === "md"
      ? "max-w-md"
      : maxWidth === "lg"
      ? "max-w-lg"
      : "max-w-xl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className={`bg-[#111111] border border-[#222222] rounded-2xl p-6 ${widthClass} w-full space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          title="Close Modal"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start space-x-3">
          {Icon && (
            <div className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 text-red-400">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-white">{title}</h3>
            {description && <p className="text-xs text-neutral-400 leading-relaxed">{description}</p>}
          </div>
        </div>

        {children && <div className="py-2">{children}</div>}

        {footer && <div className="flex items-center justify-end space-x-3 pt-2">{footer}</div>}
      </div>
    </div>
  );
};
