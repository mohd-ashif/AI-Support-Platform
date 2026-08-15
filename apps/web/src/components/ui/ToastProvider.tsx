"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { ToastItem, ToastMessage, ToastType } from "./Toast";

interface ToastOptions {
  id?: string;
  title?: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, options?: ToastOptions) => void;
    error: (message: string, options?: ToastOptions) => void;
    warning: (message: string, options?: ToastOptions) => void;
    info: (message: string, options?: ToastOptions) => void;
    dismiss: (id: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions) => {
      const id = options?.id || `${type}-${message.slice(0, 25)}-${Date.now()}`;
      const duration = options?.duration ?? 4500;

      setToasts((prev) => {
        const existingIdx = prev.findIndex((t) => t.id === id || (t.message === message && t.type === type));
        if (existingIdx !== -1) {
          return prev;
        }
        return [...prev, { id, type, title: options?.title, message, duration }];
      });

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const toast = {
    success: (message: string, options?: ToastOptions) => addToast("success", message, options),
    error: (message: string, options?: ToastOptions) => addToast("error", message, options),
    warning: (message: string, options?: ToastOptions) => addToast("warning", message, options),
    info: (message: string, options?: ToastOptions) => addToast("info", message, options),
    dismiss,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        role="region"
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col space-y-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType["toast"] => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
};
