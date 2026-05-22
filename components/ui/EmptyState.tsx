import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
      <div className="mb-1 text-sm font-semibold text-slate-700">{title}</div>
      {description ? <div className="max-w-md text-xs text-slate-500">{description}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
