"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

type ToastTone = "info" | "success" | "danger";
type ToastItem = { id: string; message: string; tone: ToastTone };

type ToastContextValue = {
  show: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    const id = makeId();
    setItems((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((item) => {
          const tone = item.tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : item.tone === "danger"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-slate-200 bg-slate-900 text-white";
          return (
            <div
              key={item.id}
              className={`pointer-events-auto rounded-full border px-4 py-2 text-sm shadow-lg ${tone}`}
            >
              {item.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: (message: string) => {
        if (typeof window !== "undefined") console.warn("Toast outside provider:", message);
      }
    };
  }
  return ctx;
}

export function useAutoDismiss(value: unknown, onClear: () => void, ms = 2200) {
  useEffect(() => {
    if (!value) return;
    const id = setTimeout(onClear, ms);
    return () => clearTimeout(id);
  }, [value, onClear, ms]);
}
