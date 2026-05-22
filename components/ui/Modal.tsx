"use client";

import { ReactNode, useEffect } from "react";

export function Modal({
  open,
  title,
  description,
  onClose,
  footer,
  children,
  size = "md"
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
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

  const widthClass = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`w-full ${widthClass} overflow-hidden rounded-lg bg-white shadow-xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900" aria-label="关闭">
              ✕
            </button>
          </div>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-slate-200 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
