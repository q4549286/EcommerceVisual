"use client";

import { ReactNode, useEffect } from "react";

export function Drawer({
  open,
  title,
  description,
  onClose,
  children,
  width = 520
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <aside
        className="flex h-full flex-col border-l border-slate-200 bg-white shadow-2xl"
        style={{ width }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">{title}</h3>
            {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900" aria-label="关闭">
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}
