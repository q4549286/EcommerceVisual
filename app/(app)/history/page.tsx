"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Buttons";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tag } from "@/components/ui/Tag";
import { TextInput } from "@/components/ui/FormField";
import { useToast } from "@/components/ui/Toast";
import { formatRelative } from "@/lib/format";
import type { HistoryEntry, ImagePlan } from "@/lib/types";

const HISTORY_KEY = "ecv:history";

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function getHistoryStatus(entry: HistoryEntry): NonNullable<HistoryEntry["status"]> {
  if (entry.status) return entry.status;
  if (entry.successCount > 0 && entry.successCount >= entry.imageCount && entry.failCount === 0) return "success";
  if (entry.successCount > 0) return "partial";
  if (entry.failCount > 0) return "failed";
  return "running";
}

function getHistoryBadge(entry: HistoryEntry) {
  const status = getHistoryStatus(entry);
  if (status === "success") return { label: "生成成功", tone: "success" as const };
  if (status === "partial") return { label: `${entry.successCount}/${entry.imageCount} 成功`, tone: "warning" as const };
  if (status === "failed") return { label: "生成失败", tone: "danger" as const };
  if (status === "canceled") return { label: "已终止", tone: "warning" as const };
  return { label: "生成中", tone: "neutral" as const };
}

export default function HistoryPage() {
  const { show } = useToast();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<"all" | "success" | "fail">("all");
  const [active, setActive] = useState<HistoryEntry | null>(null);
  const [preview, setPreview] = useState<ImagePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function load() {
    setLoading(true);
    setHistory(loadHistory());
    setLoading(false);
  }

  function persist(next: HistoryEntry[]) {
    setHistory(next);
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
    }
  }

  async function deleteEntry(entry: HistoryEntry) {
    setDeletingId(entry.id);
    try {
      const next = history.filter((item) => item.id !== entry.id);
      persist(next);
      if (active?.id === entry.id) setActive(null);
      if (preview && entry.plans.some((plan) => plan.type === preview.type)) setPreview(null);
      show("已删除本机历史", "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "删除历史记录失败", "danger");
    } finally {
      setDeletingId("");
    }
  }

  const filtered = useMemo(() => {
    return history.filter((entry) => {
      const status = getHistoryStatus(entry);
      if (keyword && !entry.productName.toLowerCase().includes(keyword.toLowerCase())) return false;
      if (filter === "success" && status !== "success") return false;
      if (filter === "fail" && !["partial", "failed", "canceled"].includes(status)) return false;
      return true;
    });
  }, [history, keyword, filter]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 md:pl-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">历史记录</h1>
          <p className="mt-1 text-sm text-slate-500">最近的生成结果只保存在当前浏览器本机，方便随时查阅与重用提示词。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>刷新</Button>
          {history.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => {
              if (confirm("确认清空本机历史？")) persist([]);
            }}>清空本机缓存</Button>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索商品名"
          className="max-w-xs"
        />
        <div className="flex items-center gap-1 rounded border border-slate-200 bg-white p-1 text-xs">
          {(["all", "success", "fail"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded px-3 py-1 ${filter === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {value === "all" ? "全部" : value === "success" ? "全部成功" : "含失败"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={loading ? "正在加载历史" : "暂无历史"}
          description={loading ? "正在读取本机历史。" : history.length === 0 ? "生成第一张图后，记录会保存在当前浏览器。" : "当前筛选下没有数据。"}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const thumb = entry.plans.find((p) => p.imageUrl)?.imageUrl;
            const badge = getHistoryBadge(entry);
            return (
              <article key={entry.id} className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50">
                  {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] text-slate-400">无图</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{entry.productName || "未命名"}</h3>
                    <Tag tone={badge.tone}>{badge.label}</Tag>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.successCount}/{entry.imageCount} 张 · {entry.language} · {formatRelative(entry.timestamp)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setActive(entry)}>查看</Button>
                  <Button variant="ghost" size="sm" onClick={() => void deleteEntry(entry)} disabled={deletingId === entry.id}>
                    {deletingId === entry.id ? "删除中" : "删除"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Drawer open={!!active} onClose={() => setActive(null)} title={active?.productName || "查看"} description={active ? `${active.imageCount} 张 · ${formatRelative(active.timestamp)}` : ""}>
        {active ? (
          <div className="space-y-4">
            {active.plans.map((plan) => (
              <div key={plan.type} className="overflow-hidden rounded border border-slate-200">
                <div className="aspect-video bg-slate-50">
                  {plan.imageUrl ? (
                    <button type="button" onClick={() => setPreview(plan)} className="h-full w-full cursor-zoom-in">
                      <img src={plan.imageUrl} alt={plan.title} className="h-full w-full object-cover transition-transform hover:scale-[1.02]" />
                    </button>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">{plan.error || "未生成"}</div>
                  )}
                </div>
                <div className="p-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 font-semibold">{plan.title}</div>
                      <div className="text-slate-500">{plan.size}</div>
                    </div>
                    {plan.imageUrl ? (
                      <a href={plan.imageUrl} download={`${plan.type}.png`} className="rounded bg-slate-900 px-2.5 py-1 text-xs text-white hover:bg-black">
                        下载
                      </a>
                    ) : null}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-slate-500 hover:text-slate-900">查看提示词</summary>
                    <p className="mt-2 whitespace-pre-wrap text-slate-600">{plan.prompt}</p>
                  </details>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Drawer>

      {preview?.imageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          <div className="relative max-h-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute right-0 top-0 z-10 rounded-bl bg-black/70 px-3 py-2 text-xs text-white hover:bg-black"
            >
              关闭
            </button>
            <img src={preview.imageUrl} alt={preview.title} className="max-h-[88vh] max-w-full rounded bg-white object-contain shadow-2xl" />
            <div className="mt-3 flex items-center justify-between gap-3 rounded bg-white px-3 py-2 text-xs">
              <span className="font-medium text-slate-900">{preview.title}</span>
              <a href={preview.imageUrl} download={`${preview.type}.png`} className="rounded bg-slate-900 px-3 py-1.5 text-white hover:bg-black">
                下载
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
