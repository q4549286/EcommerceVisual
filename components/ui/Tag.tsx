import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "danger" | "warning" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-slate-900 text-white border-slate-900"
};

export function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}
